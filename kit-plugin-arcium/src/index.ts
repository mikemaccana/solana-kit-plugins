export { arcium, createKiteArciumPlugin } from "./lib/plugin.js";
export type {
  ArciumMethods,
  ConnectionWithArcium,
  ArciumPluginConfig,
} from "./lib/plugin.js";
export { ArciumClient } from "./lib/arcium-client.js";
export type { ClientSideKeys } from "./lib/encryption.js";

// Standalone utilities (no Connection needed)
export {
  getRandomNonce,
  getRandomBigInt,
  serializeLE,
  deserializeLE,
  getArciumClusterOffset,
} from "./lib/serialization.js";

export {
  getComputationDefinitionAccountOffset,
  MAX_UPLOAD_PER_TX_BYTES,
  MAX_REALLOC_PER_IX,
  MAX_ACCOUNT_SIZE,
  MAX_EMBIGGEN_IX_PER_TX,
} from "./lib/idl-helpers.js";

export { parseAnchorEventFromLogs } from "./lib/events.js";

export { ARCIUM_PROGRAM_ID, ADDRESS_LOOKUP_TABLE_PROGRAM_ID } from "./lib/constants.js";

export {
  RescueCipher,
  CSplRescueCipher,
  RescuePrimeHash,
  arcisEd25519,
  AesCtrCipher,
  Aes128Cipher,
  Aes192Cipher,
  Aes256Cipher,
} from "./lib/rescue-cipher.js";
