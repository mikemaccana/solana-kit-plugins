import type { Address } from "@solana/kit";
import { unwrapOption } from "@solana/kit";
import type { TokenMetadata, Creator, Collection, Uses } from "./types.js";
import { MetadataSource } from "./constants.js";
import { getMetadataDecoder } from "../generated/mpl_token_metadata-client/accounts/metadata.js";
import type { Metadata } from "../generated/mpl_token_metadata-client/accounts/metadata.js";
import { UseMethod } from "../generated/mpl_token_metadata-client/types/useMethod.js";

const metadataDecoder = getMetadataDecoder();

/** Trims trailing NUL padding from a fixed-length on-chain string. */
function trimNuls(value: string): string {
  return value.replace(/\0+$/, "");
}

const USE_METHOD_NAMES: Record<UseMethod, Uses["useMethod"]> = {
  [UseMethod.Burn]: "Burn",
  [UseMethod.Multiple]: "Multiple",
  [UseMethod.Single]: "Single",
};

/**
 * Maps a Codama-generated Metaplex {@link Metadata} struct to the plugin's
 * domain {@link TokenMetadata} type. The on-chain `mint` is used in preference
 * to the supplied `mintAddress`, but the argument is kept to preserve the
 * existing public behavior.
 */
export function mapMetadataToTokenMetadata(metadata: Metadata, mintAddress: Address): TokenMetadata {
  const creatorsOption = unwrapOption(metadata.data.creators);
  const creators: Array<Creator> | undefined = creatorsOption
    ? creatorsOption.map((creator) => ({
        address: creator.address,
        verified: creator.verified,
        share: creator.share,
      }))
    : undefined;

  const collectionValue = unwrapOption(metadata.collection);
  const collection: Collection | undefined = collectionValue
    ? { verified: collectionValue.verified, key: collectionValue.key }
    : undefined;

  const usesValue = unwrapOption(metadata.uses);
  const uses: Uses | undefined = usesValue
    ? {
        useMethod: USE_METHOD_NAMES[usesValue.useMethod],
        remaining: usesValue.remaining,
        total: usesValue.total,
      }
    : undefined;

  return {
    source: MetadataSource.METAPLEX,
    mint: mintAddress,
    updateAuthority: metadata.updateAuthority,
    name: trimNuls(metadata.data.name),
    symbol: trimNuls(metadata.data.symbol),
    uri: trimNuls(metadata.data.uri),
    sellerFeeBasisPoints: metadata.data.sellerFeeBasisPoints,
    creators,
    collection,
    uses,
    primarySaleHappened: metadata.primarySaleHappened,
    isMutable: metadata.isMutable,
  };
}

/**
 * Deserializes a Metaplex Token Metadata account using the Codama-generated
 * decoder, then maps the result to the plugin's domain {@link TokenMetadata}.
 */
export function deserializeMetaplexMetadata(data: Uint8Array, mintAddress: Address): TokenMetadata {
  const metadata = metadataDecoder.decode(data);
  return mapMetadataToTokenMetadata(metadata, mintAddress);
}
