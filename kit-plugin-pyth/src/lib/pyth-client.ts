import type { Address, TransactionSendingSigner } from "@solana/kit";
import {
  AccountRole,
  addSignersToInstruction,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  SOLANA_ERROR__TRANSACTION__EXCEEDS_SIZE_LIMIT,
} from "@solana/kit";
import type { Connection } from "solana-kite";
import type {
  PythConfig,
  PythPriceFeed,
  PythPrice,
  PythOnchainPriceData,
  PythFeedInfo,
  PythPriceStatus,
  PythPriceCallback,
} from "./types.js";
import {
  HERMES_URL,
  PYTH_RECEIVER_PROGRAM_ID,
  WORMHOLE_PROGRAM_ID,
  PYTH_PRICE_ACCOUNT_MAGIC,
  PYTH_ACCOUNT_TYPE_PRICE,
  PYTH_PRICE_ACCOUNT_MIN_SIZE,
  PYTH_STATUS_UNKNOWN,
  PYTH_STATUS_TRADING,
  PYTH_STATUS_HALTED,
  PYTH_STATUS_AUCTION,
  ACCUMULATOR_UPDATE_MAGIC,
  ACCUMULATOR_UPDATE_TYPE_WORMHOLE_MERKLE,
  ACCUMULATOR_PRICE_MESSAGE_TYPE,
  POST_UPDATE_ATOMIC_DISCRIMINATOR,
  DEFAULT_TREASURY_ID,
} from "./constants.js";

// Internal types for Hermes API responses
interface HermesPriceData {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}

interface HermesParsedFeed {
  id: string;
  price: HermesPriceData;
  ema_price: HermesPriceData;
}

interface HermesResponse {
  binary: { data: Array<string> };
  parsed: Array<HermesParsedFeed>;
}

interface HermesFeedInfo {
  id: string;
  attributes: {
    asset_type: string;
    base: string;
    description: string;
    generic_symbol?: string;
    quote_currency: string;
    symbol: string;
    tenor?: string;
  };
}

interface AccumulatorUpdate {
  vaa: Uint8Array;
  // Map from feed ID (hex, no 0x) to its merkle price update data
  updatesByFeedId: Map<string, { message: Uint8Array; proof: Array<Uint8Array> }>;
}

// In JS it's possible to throw *anything*. A sensible programmer
// will only throw Errors but we must still check to satisfy
// TypeScript (and flag any craziness)
function ensureError(thrownObject: unknown): Error {
  if (thrownObject instanceof Error) {
    return thrownObject;
  }
  return new Error(`Non-Error thrown: ${String(thrownObject)}`);
}

function normalizeFeedId(feedId: string): string {
  return feedId.startsWith("0x") ? feedId.slice(2) : feedId;
}

function parseHermesPrice(data: HermesPriceData): PythPrice {
  const multiplier = Math.pow(10, data.expo);
  return {
    price: Number(data.price) * multiplier,
    confidence: Number(data.conf) * multiplier,
    exponent: data.expo,
    publishTime: data.publish_time,
  };
}

export function parsePythPriceAccountData(data: Uint8Array): PythOnchainPriceData | null {
  if (data.length < PYTH_PRICE_ACCOUNT_MIN_SIZE) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (view.getUint32(0, true) !== PYTH_PRICE_ACCOUNT_MAGIC) return null;
  if (view.getUint32(8, true) !== PYTH_ACCOUNT_TYPE_PRICE) return null;

  const exponent = view.getInt32(20, true);
  const emaPriceRaw = view.getBigInt64(48, true);
  const emaConfRaw = view.getBigUint64(56, true);
  const timestamp = view.getBigInt64(64, true);
  const priceRaw = view.getBigInt64(100, true);
  const confRaw = view.getBigUint64(108, true);
  const statusCode = view.getUint32(116, true);
  const slot = view.getBigUint64(124, true);

  const multiplier = Math.pow(10, exponent);

  const statusByCode: Record<number, PythPriceStatus> = {
    [PYTH_STATUS_UNKNOWN]: "unknown",
    [PYTH_STATUS_TRADING]: "trading",
    [PYTH_STATUS_HALTED]: "halted",
    [PYTH_STATUS_AUCTION]: "auction",
  };
  const status = statusByCode[statusCode] ?? "unknown";

  return {
    price: Number(priceRaw) * multiplier,
    confidence: Number(confRaw) * multiplier,
    exponent,
    emaPrice: Number(emaPriceRaw) * multiplier,
    emaConfidence: Number(emaConfRaw) * multiplier,
    status,
    publishTime: timestamp,
    slot,
  };
}

// Parses the binary accumulator update from Hermes.
// Format: https://github.com/pyth-network/pyth-crosschain (accumulator message spec)
function parseAccumulatorUpdate(data: Uint8Array): AccumulatorUpdate {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  const magic = view.getUint32(offset, false);
  offset += 4;
  if (magic !== ACCUMULATOR_UPDATE_MAGIC) {
    throw new Error(`Invalid accumulator magic: 0x${magic.toString(16)}`);
  }

  const majorVersion = view.getUint8(offset++);
  if (majorVersion !== 1) {
    throw new Error(`Unsupported accumulator version: ${majorVersion}`);
  }
  offset++; // minor version
  const trailingHeaderSize = view.getUint8(offset++);
  offset += trailingHeaderSize;

  const updateType = view.getUint8(offset++);
  if (updateType !== ACCUMULATOR_UPDATE_TYPE_WORMHOLE_MERKLE) {
    throw new Error(`Unsupported accumulator update type: ${updateType}`);
  }

  const vaaLength = view.getUint16(offset, false);
  offset += 2;
  const vaa = data.slice(offset, offset + vaaLength);
  offset += vaaLength;

  const numUpdates = view.getUint8(offset++);
  const updatesByFeedId = new Map<string, { message: Uint8Array; proof: Array<Uint8Array> }>();

  for (let i = 0; i < numUpdates; i++) {
    const messageLength = view.getUint16(offset, false);
    offset += 2;
    const message = data.slice(offset, offset + messageLength);
    offset += messageLength;

    const proofCount = view.getUint8(offset++);
    const proof: Array<Uint8Array> = [];
    for (let j = 0; j < proofCount; j++) {
      proof.push(data.slice(offset, offset + 20));
      offset += 20;
    }

    // Extract feed ID from the price message (type byte + 32-byte feed ID)
    if (message.length >= 33 && message[0] === ACCUMULATOR_PRICE_MESSAGE_TYPE) {
      const feedId = Buffer.from(message.slice(1, 33)).toString("hex");
      updatesByFeedId.set(feedId, { message, proof });
    }
  }

  return { vaa, updatesByFeedId };
}

// Borsh-encodes a byte vector: 4-byte LE length prefix + bytes
function borshEncodeBytes(bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(4 + bytes.length);
  new DataView(result.buffer).setUint32(0, bytes.length, true);
  result.set(bytes, 4);
  return result;
}

// Borsh-encodes a Vec<[u8; 20]>: 4-byte LE count + (count * 20) bytes
function borshEncodeProofVec(proofs: Array<Uint8Array>): Uint8Array {
  const result = new Uint8Array(4 + proofs.length * 20);
  new DataView(result.buffer).setUint32(0, proofs.length, true);
  let offset = 4;
  for (const proof of proofs) {
    result.set(proof.slice(0, 20), offset);
    offset += 20;
  }
  return result;
}

function buildPostUpdateAtomicData(
  vaa: Uint8Array,
  message: Uint8Array,
  proof: Array<Uint8Array>,
  treasuryId: number,
): Uint8Array {
  const parts = [
    POST_UPDATE_ATOMIC_DISCRIMINATOR,
    borshEncodeBytes(vaa),
    borshEncodeBytes(message),
    borshEncodeProofVec(proof),
    new Uint8Array([treasuryId]),
  ];
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// Anchor discriminator for reclaimRent: sha256("global:reclaim_rent")[0..8]
const RECLAIM_RENT_DISCRIMINATOR = new Uint8Array([218, 200, 19, 197, 227, 89, 192, 22]);

export class PythClient {
  private hermesUrl: string;
  private connection: Connection;

  constructor(connection: Connection, config: PythConfig = {}) {
    this.connection = connection;
    this.hermesUrl = config.hermesUrl ?? HERMES_URL;
  }

  async getPythPriceFeed(feedId: string): Promise<PythPriceFeed | null> {
    const normalizedId = normalizeFeedId(feedId);
    const { feeds } = await this.fetchHermesLatest([normalizedId]);
    return feeds.get(normalizedId) ?? null;
  }

  async getPythPriceFeeds(feedIds: Array<string>): Promise<Map<string, PythPriceFeed>> {
    const normalizedIds = feedIds.map(normalizeFeedId);
    const { feeds } = await this.fetchHermesLatest(normalizedIds);
    return feeds;
  }

  private async fetchHermesLatest(
    feedIds: Array<string>,
  ): Promise<{ feeds: Map<string, PythPriceFeed>; binaryData: Uint8Array | null }> {
    const params = new URLSearchParams();
    for (const feedId of feedIds) {
      params.append("ids[]", `0x${feedId}`);
    }
    params.set("parsed", "true");
    params.set("encoding", "base64");

    const response = await fetch(`${this.hermesUrl}/v2/updates/price/latest?${params}`);
    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as HermesResponse;

    const feeds = new Map<string, PythPriceFeed>();
    for (const feed of data.parsed) {
      const normalizedId = normalizeFeedId(feed.id);
      feeds.set(normalizedId, {
        id: normalizedId,
        price: parseHermesPrice(feed.price),
        emaPrice: parseHermesPrice(feed.ema_price),
      });
    }

    const binaryData =
      data.binary?.data?.[0] != null ? new Uint8Array(Buffer.from(data.binary.data[0], "base64")) : null;

    return { feeds, binaryData };
  }

  async getPythOnchainPrice(priceAccountAddress: Address): Promise<PythOnchainPriceData | null> {
    try {
      const accountInfo = await this.connection.rpc
        .getAccountInfo(priceAccountAddress, { encoding: "base64" })
        .send();
      if (!accountInfo.value) return null;

      const [encodedData] = accountInfo.value.data as readonly [string, string];
      const rawBytes = new Uint8Array(Buffer.from(encodedData, "base64"));
      return parsePythPriceAccountData(rawBytes);
    } catch {
      return null;
    }
  }

  async isPythPriceStale(feedId: string, maxAgeSeconds: number): Promise<boolean> {
    const feed = await this.getPythPriceFeed(feedId);
    if (!feed) return true;
    const ageSeconds = Date.now() / 1000 - feed.price.publishTime;
    return ageSeconds > maxAgeSeconds;
  }

  async searchPythFeeds(query: string, assetType?: string): Promise<Array<PythFeedInfo>> {
    const params = new URLSearchParams({ query });
    if (assetType) {
      params.set("asset_type", assetType);
    }
    const response = await fetch(`${this.hermesUrl}/v2/price_feeds?${params}`);
    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as Array<HermesFeedInfo>;
    return data.map((feed) => ({
      id: normalizeFeedId(feed.id),
      attributes: feed.attributes,
    }));
  }

  watchPythPriceFeed(feedId: string, callback: PythPriceCallback, intervalMs: number = 1000): () => void {
    const poll = async () => {
      try {
        const feed = await this.getPythPriceFeed(feedId);
        if (feed) {
          callback(null, feed);
        } else {
          callback(new Error(`Price not found for feed ${feedId}`), null);
        }
      } catch (thrownObject) {
        const error = ensureError(thrownObject);
        callback(error, null);
      }
    };

    poll();
    const intervalId = setInterval(poll, intervalMs);
    return () => clearInterval(intervalId);
  }

  async postPythPriceUpdate(feedId: string, payer: TransactionSendingSigner): Promise<Address> {
    const [address] = await this.postPythPriceUpdates([feedId], payer);
    return address!;
  }

  async postPythPriceUpdates(
    feedIds: Array<string>,
    payer: TransactionSendingSigner,
  ): Promise<Array<Address>> {
    const normalizedIds = feedIds.map(normalizeFeedId);

    const { binaryData } = await this.fetchHermesLatest(normalizedIds);
    if (!binaryData) {
      throw new Error("No binary data returned from Hermes");
    }

    const accumulatorUpdate = parseAccumulatorUpdate(binaryData);

    // The guardian set index is at bytes 1-4 of the VAA (big-endian)
    const vaaGuardianSetIndex = new DataView(accumulatorUpdate.vaa.buffer).getUint32(1, false);

    const [configAddress] = await getProgramDerivedAddress({
      programAddress: PYTH_RECEIVER_PROGRAM_ID,
      seeds: [new TextEncoder().encode("config")],
    });

    const [treasuryAddress] = await getProgramDerivedAddress({
      programAddress: PYTH_RECEIVER_PROGRAM_ID,
      seeds: [new TextEncoder().encode("treasury"), new Uint8Array([DEFAULT_TREASURY_ID])],
    });

    const guardianSetIndexBytes = new Uint8Array(4);
    new DataView(guardianSetIndexBytes.buffer).setUint32(0, vaaGuardianSetIndex, false);
    const [guardianSetAddress] = await getProgramDerivedAddress({
      programAddress: WORMHOLE_PROGRAM_ID,
      seeds: [new TextEncoder().encode("GuardianSet"), guardianSetIndexBytes],
    });

    // Send one transaction per feed, all in parallel
    const priceUpdateAddresses = await Promise.all(
      normalizedIds.map(async (feedId) => {
        const update = accumulatorUpdate.updatesByFeedId.get(feedId);
        if (!update) {
          throw new Error(`Feed ${feedId} not found in accumulator update`);
        }

        const priceUpdateSigner = await generateKeyPairSigner();

        const instructionData = buildPostUpdateAtomicData(
          accumulatorUpdate.vaa,
          update.message,
          update.proof,
          DEFAULT_TREASURY_ID,
        );

        const instruction = addSignersToInstruction([payer, priceUpdateSigner], {
          programAddress: PYTH_RECEIVER_PROGRAM_ID,
          accounts: [
            { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
            { address: guardianSetAddress, role: AccountRole.READONLY },
            { address: configAddress, role: AccountRole.READONLY },
            { address: treasuryAddress, role: AccountRole.WRITABLE },
            { address: priceUpdateSigner.address, role: AccountRole.WRITABLE_SIGNER },
            {
              address: "11111111111111111111111111111111" as Address,
              role: AccountRole.READONLY,
            },
            { address: payer.address, role: AccountRole.READONLY_SIGNER },
          ],
          data: instructionData,
        });

        await this.connection.sendTransactionFromInstructions({
          feePayer: payer,
          instructions: [instruction],
        });

        return priceUpdateSigner.address;
      }),
    );

    return priceUpdateAddresses;
  }

  async reclaimPythPriceUpdateRent(
    priceUpdateAccount: Address,
    payer: TransactionSendingSigner,
  ): Promise<string> {
    const instruction = addSignersToInstruction([payer], {
      programAddress: PYTH_RECEIVER_PROGRAM_ID,
      accounts: [
        { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: priceUpdateAccount, role: AccountRole.WRITABLE },
      ],
      data: RECLAIM_RENT_DISCRIMINATOR,
    });

    return this.connection.sendTransactionFromInstructions({
      feePayer: payer,
      instructions: [instruction],
    });
  }
}
