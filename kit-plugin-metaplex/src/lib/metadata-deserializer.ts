import type { Address } from "@solana/kit";
import { address } from "@solana/kit";
import type { TokenMetadata, Creator, Collection } from "./types.js";
import { MetadataSource } from "./constants.js";

/**
 * Deserializes a Metaplex Token Metadata account.
 * This is a simplified deserializer that handles the most common Metadata V1 format.
 *
 * Note: For production use with all metadata variations, consider using a
 * proper Codama-generated client from the Metaplex Token Metadata IDL.
 */
export function deserializeMetaplexMetadata(data: Uint8Array, mintAddress: Address): TokenMetadata {
  let offset = 0;

  const readU8 = (): number => data[offset++];
  const readU16 = (): number => data[offset++] | (data[offset++] << 8);
  const readU32 = (): number =>
    data[offset++] | (data[offset++] << 8) | (data[offset++] << 16) | (data[offset++] << 24);

  const readPublicKey = (): Address => {
    const bytes = data.slice(offset, offset + 32);
    offset += 32;
    return address(Buffer.from(bytes).toString("base64"));
  };

  const readString = (): string => {
    const length = readU32();
    const bytes = data.slice(offset, offset + length);
    offset += length;
    return new TextDecoder().decode(bytes).replace(/\0+$/, "");
  };

  const readOption = <T>(reader: () => T): T | undefined => {
    const hasValue = readU8();
    return hasValue ? reader() : undefined;
  };

  // Skip discriminator (1 byte) and account type (1 byte)
  offset = 1;

  const updateAuthority = readPublicKey();
  const mint = readPublicKey();
  const name = readString();
  const symbol = readString();
  const uri = readString();
  const sellerFeeBasisPoints = readU16();

  // Read creators (Option<Vec<Creator>>)
  const hasCreators = readU8();
  let creators: Array<Creator> | undefined;
  if (hasCreators) {
    const creatorsLength = readU32();
    creators = [];
    for (let i = 0; i < creatorsLength; i++) {
      const creatorAddress = readPublicKey();
      const verified = readU8() === 1;
      const share = readU8();
      creators.push({
        address: creatorAddress,
        verified,
        share,
      });
    }
  }

  const primarySaleHappened = readU8() === 1;
  const isMutable = readU8() === 1;

  // Read edition nonce (Option<u8>)
  readOption(() => readU8());

  // Read token standard (Option<TokenStandard>)
  readOption(() => readU8());

  // Read collection (Option<Collection>)
  let collection: Collection | undefined;
  const hasCollection = readU8();
  if (hasCollection) {
    const verified = readU8() === 1;
    const key = readPublicKey();
    collection = { verified, key };
  }

  return {
    source: MetadataSource.METAPLEX,
    mint: mintAddress,
    updateAuthority,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    creators,
    collection,
    primarySaleHappened,
    isMutable,
  };
}
