import { address } from "@solana/kit";
import type { Address } from "@solana/kit";

/**
 * Metaplex Token Metadata Program ID
 */
export const METADATA_PROGRAM_ID: Address = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/**
 * Metadata account discriminator for Metaplex Token Metadata V1
 */
export const METADATA_DISCRIMINATOR = [112, 113, 118, 119, 120]; // First 5 bytes of metadata account

/**
 * Metadata type indicators
 */
export enum MetadataSource {
  METAPLEX = "metaplex",
  TOKEN_EXTENSIONS = "token-extensions",
  NONE = "none",
}
