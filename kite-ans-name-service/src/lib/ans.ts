import { connect } from "solana-kite";
import { address, type Address, getProgramDerivedAddress } from "@solana/kit";
import { getBase58Decoder } from "@solana/codecs";
import { createHash } from "node:crypto";
import {
  ANS_PROGRAM_ID,
  ROOT_ANS_PUBLIC_KEY,
  HASH_PREFIX,
  ORIGIN_TLD,
  ANS_OWNER_OFFSET_START,
  ANS_OWNER_OFFSET_END,
  DEFAULT_CACHE_TIME,
  DEFAULT_ANS_CLUSTER,
} from "./constants.js";
import type { ANSCacheEntry } from "./types.js";
import { ensureError } from "./utils.js";

export class ANSClient {
  private cacheTime: number;
  private cluster: string;
  private forwardCache: Map<string, ANSCacheEntry>;
  private reverseCache: Map<string, Array<string>>;

  constructor(cacheTime: number = DEFAULT_CACHE_TIME, cluster: string = DEFAULT_ANS_CLUSTER) {
    this.cacheTime = cacheTime;
    this.cluster = cluster;
    this.forwardCache = new Map();
    this.reverseCache = new Map();
  }

  private getHashedName(name: string): Buffer {
    const input = HASH_PREFIX + name;
    const hash = createHash("sha256").update(input, "utf8").digest();
    return Buffer.from(hash);
  }

  private getCachedAddress(domain: string): Address | null {
    const cached = this.forwardCache.get(domain);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.forwardCache.delete(domain);
      return null;
    }

    return cached.address;
  }

  private setCachedAddress(domain: string, resolvedAddress: Address): void {
    this.forwardCache.set(domain, {
      address: resolvedAddress,
      expiresAt: Date.now() + this.cacheTime,
    });
  }

  private async getOriginNameAccountKey(): Promise<Address> {
    const hashedName = this.getHashedName(ORIGIN_TLD);
    const nclassBytes = Buffer.alloc(32);
    const parentBytes = Buffer.alloc(32);

    const [nameAccountKey] = await getProgramDerivedAddress({
      programAddress: ANS_PROGRAM_ID,
      seeds: [hashedName, nclassBytes, parentBytes],
    });

    return nameAccountKey;
  }

  private async resolveANS(domain: string): Promise<Address> {
    const connection = connect(this.cluster);

    const parts = domain.split(".");
    if (parts.length < 2) {
      throw new Error(`Invalid domain format: ${domain}`);
    }

    const domainName = parts[0];
    const tld = "." + parts[1];

    const originNameAccountKey = await this.getOriginNameAccountKey();

    const tldHashedName = this.getHashedName(tld);
    const nclassBytes = Buffer.alloc(32);
    const originBytes = Buffer.from(originNameAccountKey);

    const [tldParentAccountKey] = await getProgramDerivedAddress({
      programAddress: ANS_PROGRAM_ID,
      seeds: [tldHashedName, nclassBytes, originBytes],
    });

    const domainHashedName = this.getHashedName(domainName);
    const tldParentBytes = Buffer.from(tldParentAccountKey);

    const [domainAccountKey] = await getProgramDerivedAddress({
      programAddress: ANS_PROGRAM_ID,
      seeds: [domainHashedName, nclassBytes, tldParentBytes],
    });

    const accountInfo = await connection.rpc
      .getAccountInfo(domainAccountKey, { encoding: "base64" })
      .send();

    if (!accountInfo.value) {
      throw new Error(`Domain ${domain} not found`);
    }

    const accountData = Buffer.from(accountInfo.value.data[0], "base64");

    const ownerBytes = accountData.subarray(ANS_OWNER_OFFSET_START, ANS_OWNER_OFFSET_END);
    const ownerAddress = getBase58Decoder().decode(ownerBytes);

    return address(ownerAddress);
  }

  async getAddressForANSName(input: string): Promise<Address> {
    const parts = input.split(".");

    if (parts.length < 2) {
      try {
        return address(input);
      } catch (thrownObject) {
        const error = ensureError(thrownObject);
        throw new Error(`Invalid domain format: ${input}. Not a valid address or ANS domain.`);
      }
    }

    const cached = this.getCachedAddress(input);
    if (cached) {
      return cached;
    }

    try {
      const resolvedAddress = await this.resolveANS(input);
      this.setCachedAddress(input, resolvedAddress);
      return resolvedAddress;
    } catch (thrownObject) {
      const error = ensureError(thrownObject);
      throw new Error(`Failed to resolve ANS domain ${input}: ${error.message}`);
    }
  }

  async getANSNamesForAddress(resolvedAddress: Address): Promise<Array<string>> {
    const addressString = String(resolvedAddress);

    const cached = this.reverseCache.get(addressString);
    if (cached) {
      return cached;
    }

    return [];
  }

  clearCache(): void {
    this.forwardCache.clear();
    this.reverseCache.clear();
  }
}
