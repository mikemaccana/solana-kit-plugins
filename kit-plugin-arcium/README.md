# Solana Kite Arcium

Arcium confidential computing plugin for Solana Kite. Provides onchain helpers for working with the Arcium MXE (Masked Execution Environment) — PDA derivation, encryption key generation, circuit uploading, and computation event listening — all using the provided Kite connection rather than creating internal connections.

## Features

- **PDA Derivation**: All Arcium account addresses (MXE, computation, mempool, cluster, computation definition)
- **Encryption**: Client-side x25519 key generation and shared secret derivation with the MXE
- **Circuit Upload**: Full circuit upload pipeline (init, resize, upload, finalize)
- **Event Listening**: Wait for `FinalizeComputationEvent` via polling or WebSocket subscription
- **IDL-Driven**: Instruction and event discriminators read from the Arcium IDL — no hardcoded magic bytes
- **No web3.js**: Built entirely on Solana Kit
- **No bs58**: Uses `@solana/kit` address encoding throughout

## Installation

```bash
npm install kit-plugin-arcium solana-kite @solana/kit
```

## Quick Start

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { arcium } from "kit-plugin-arcium";
import { address } from "@solana/kit";

const mxeProgramId = address("YourMXEProgramId...");

const connection = createClient().use(kite({ clusterNameOrURL: "localnet" })).use(
  arcium({ artifactsDir: "./artifacts" })
);

// Derive an MXE account address
const mxeAccount = await connection.arcium.getMXEAccountAddress(mxeProgramId);

// Generate client-side encryption keys
const keys = await connection.arcium.makeClientSideKeys(mxeProgramId);
// keys.publicKey    — send this to the program when initializing encrypted state
// keys.sharedSecret — use this with RescueCipher to encrypt your inputs
// keys.cipher       — a RescueCipher instance pre-initialized with the shared secret

// Upload a circuit
const signer = await connection.loadWalletFromEnvironment("WALLET_SECRET_KEY");
await connection.arcium.uploadCircuit(signer, "my_circuit", mxeProgramId, circuitBytes);

// Wait for a computation to finalize
// connection.arcium.clusterOffset is read from ARCIUM_CLUSTER_OFFSET env var automatically
const computationOffset = 12345n;
const signature = await connection.arcium.awaitComputationFinalizationSubscription(
  computationOffset,
  mxeProgramId,
);
console.log("Computation finalized in transaction:", signature);
```

## Configuration

```typescript
interface ArciumPluginConfig {
  artifactsDir?: string;
  clusterOffset?: number;
}
```

`artifactsDir` is the path to the directory containing Arcium genesis artifacts (e.g. `mxe_lut_acc.json`). Required only if you call `getMXELutAccountAddress`.

`clusterOffset` overrides the cluster offset used for PDA derivation. Defaults to reading `ARCIUM_CLUSTER_OFFSET` from the environment. Available as `connection.arcium.clusterOffset`.

```typescript
const connection = createClient().use(kite({ clusterNameOrURL: "localnet" })).use(
  arcium({ artifactsDir: "./artifacts" })
);
```

## API Reference

### `connection.arcium`

All Arcium methods are available on `connection.arcium` (an `ArciumClient` instance).

#### PDA Derivation

##### `getMXEAccountAddress(programId): Promise<Address>`

Derives the MXE account PDA for a given MXE program ID.

```typescript
const mxeAccount = await connection.arcium.getMXEAccountAddress(mxeProgramId);
```

##### `getMXELutAccountAddress(programId): Promise<Address>`

Gets the MXE Lookup Table account address from the genesis artifacts file. Requires `artifactsDir` in the plugin config.

```typescript
const lutAccount = await connection.arcium.getMXELutAccountAddress(mxeProgramId);
```

##### `getComputationAccountAddress(computationOffset): Promise<Address>`

Uses `connection.arcium.clusterOffset` automatically.

```typescript
const computationAccount = await connection.arcium.getComputationAccountAddress(computationOffset);
```

##### `mempoolAccount: Promise<Address>`

Pre-computed when the plugin is created.

```typescript
const mempoolAccount = await connection.arcium.mempoolAccount;
```

##### `executingPool: Promise<Address>`

Pre-computed when the plugin is created.

```typescript
const executingPool = await connection.arcium.executingPool;
```

##### `clusterAccount: Promise<Address>`

Pre-computed when the plugin is created.

```typescript
const clusterAccount = await connection.arcium.clusterAccount;
```

##### `getComputationDefinitionAccountAddress(mxeProgramId, offset): Promise<Address>`

`offset` is a 4-byte `Uint8Array` from `getComputationDefinitionAccountOffset(circuitName)`.

```typescript
import { getComputationDefinitionAccountOffset } from "kit-plugin-arcium";

const offset = getComputationDefinitionAccountOffset("my_circuit");
const compDefAccount = await connection.arcium.getComputationDefinitionAccountAddress(
  mxeProgramId,
  offset,
);
```

##### `getComputationDefinitionRawAddress(compDefAcc, rawCircuitIndex): Promise<Address>`

```typescript
const compDefRaw = await connection.arcium.getComputationDefinitionRawAddress(compDefAcc, 0);
```

#### Encryption

##### `getMXEPublicKeyWithRetry(programId, maxRetries?, retryDelayMs?): Promise<Uint8Array>`

Fetches the MXE's x25519 public key by reading the `MXEAccount` onchain. Retries until the account is initialized and all utility public keys are set.

```typescript
const mxePublicKey = await connection.arcium.getMXEPublicKeyWithRetry(mxeProgramId);
```

##### `makeClientSideKeys(programId): Promise<ClientSideKeys>`

Generates a client-side x25519 keypair and derives the shared secret with the MXE.

```typescript
const { privateKey, publicKey, sharedSecret, cipher } = await connection.arcium.makeClientSideKeys(mxeProgramId);
```

`cipher` is a `RescueCipher` instance pre-initialized with the shared secret, ready to use directly for encrypting inputs.

#### Event Listening

##### `awaitComputationFinalizationSubscription(computationOffset, mxeProgramId, commitment?): Promise<string>`

Waits for a `FinalizeComputationEvent` using a WebSocket log subscription. More efficient than polling. Times out after 120 seconds.

```typescript
const signature = await connection.arcium.awaitComputationFinalizationSubscription(
  computationOffset,
  mxeProgramId,
  "confirmed",
);
```

##### `awaitComputationFinalization(computationOffset, mxeProgramId, commitment?): Promise<string>`

Polls for a `FinalizeComputationEvent` by scanning recent Arcium program transactions. Use the subscription variant above when possible.

```typescript
const signature = await connection.arcium.awaitComputationFinalization(
  computationOffset,
  mxeProgramId,
);
```

#### Circuit Upload

##### `uploadCircuit(signer, circuitName, mxeProgramId, rawCircuit, logging?, chunkSize?): Promise<Array<string>>`

Uploads a compiled circuit to the Arcium network. Handles account initialization, resizing, and chunked parallel uploads, then finalizes the computation definition.

```typescript
import { readFile } from "fs/promises";

const rawCircuit = new Uint8Array(await readFile("./circuit.bin"));

const signatures = await connection.arcium.uploadCircuit(
  signer,
  "my_circuit",    // must match the circuit name used in your Arcium program
  mxeProgramId,
  rawCircuit,
  true,            // logging (default: true)
  500,             // parallel upload chunk size (default: 500)
);
console.log(`Uploaded in ${signatures.length} transactions`);
```

##### `buildFinalizeCompDefInstruction(signer, compDefOffset, mxeProgramId): Promise<Instruction>`

Builds the `finalize_computation_definition` instruction. Used internally by `uploadCircuit` but available if you need to compose it manually.

```typescript
const instruction = await connection.arcium.buildFinalizeCompDefInstruction(
  signer,
  compDefOffset,
  mxeProgramId,
);
```

---

### Standalone Utilities

These are pure functions exported directly — no connection needed.

#### `getArciumClusterOffset(): number`

Reads `ARCIUM_CLUSTER_OFFSET` from the environment and returns it as a number. The `ArciumClient` calls this automatically, so you only need this standalone utility if you require the offset value directly (e.g. for logging). It is also accessible as `connection.arcium.clusterOffset`.

```typescript
import { getArciumClusterOffset } from "kit-plugin-arcium";

const clusterOffset = getArciumClusterOffset();
```

#### `getComputationDefinitionAccountOffset(circuitName): Uint8Array`

Returns the first 4 bytes of `SHA256(circuitName)`. Used as the seed when deriving computation definition account PDAs.

```typescript
import { getComputationDefinitionAccountOffset } from "kit-plugin-arcium";

const offset = getComputationDefinitionAccountOffset("my_circuit");
```

#### `getRandomNonce(): Uint8Array`

Returns 12 random bytes suitable for use as an encryption nonce.

```typescript
import { getRandomNonce } from "kit-plugin-arcium";

const nonce = getRandomNonce();
```

#### `serializeLE(value, length): Uint8Array` / `deserializeLE(bytes): bigint`

Little-endian serialization helpers for encoding bigint values for Arcium instructions.

```typescript
import { serializeLE, deserializeLE } from "kit-plugin-arcium";

const encoded = serializeLE(12345n, 8);
const decoded = deserializeLE(encoded); // 12345n
```

#### `getRandomBigInt(): bigint`

Returns a random bigint from 8 random bytes.

#### `parseAnchorEventFromLogs(logs, eventDiscriminator): Buffer | null`

Parses Anchor events from transaction log messages. Useful when handling program callbacks.

```typescript
import { parseAnchorEventFromLogs } from "kit-plugin-arcium";

const eventData = parseAnchorEventFromLogs(transaction.meta.logMessages, myDiscriminator);
if (eventData) {
  const result = eventData[8]; // first byte after discriminator
}
```

#### Cipher classes

Crypto primitives extracted from `@arcium-hq/client` v0.8.5 to remove the web3.js v1 dependency. All cipher classes accept a shared secret from `makeClientSideKeys`.

| Class | Field | Use |
|---|---|---|
| `RescueCipher` | Curve25519 base field | Standard Arcium encryption |
| `CSplRescueCipher` | Curve25519 scalar field | cSPL variant |
| `Aes128Cipher` | — | AES-128-CTR with SHA3-256 key derivation |
| `Aes192Cipher` | — | AES-192-CTR |
| `Aes256Cipher` | — | AES-256-CTR |
| `RescuePrimeHash` | — | Rescue-XLIX hash function |
| `arcisEd25519` | — | Ed25519 with SHA3-512 (lower MPC depth) |

```typescript
import { RescueCipher, getRandomNonce } from "kit-plugin-arcium";

const { cipher } = await connection.arcium.makeClientSideKeys(mxeProgramId);
const nonce = getRandomNonce();

const encrypted = cipher.encrypt([plaintextValue], nonce);
const decrypted = cipher.decrypt(encrypted, nonce);
```

#### `ARCIUM_PROGRAM_ID`

The Arcium program address as an `Address`.

```typescript
import { ARCIUM_PROGRAM_ID } from "kit-plugin-arcium";
```

---

## Composing with Other Plugins

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { arcium } from "kit-plugin-arcium";
import { metaplex } from "kit-plugin-metaplex";

const connection = createClient().use(kite({ clusterNameOrURL: "localnet" }))
  .use(arcium({ artifactsDir: "./artifacts" }))
  .use(metaplex());
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ARCIUM_CLUSTER_OFFSET` | When calling `getArciumClusterOffset()` | Integer offset identifying the Arcium cluster |

## Requirements

- Node.js 18+
- Solana Kite 3.0+
- Solana Kit 5.0+

## License

MIT (plugin code). The `rescue-cipher.ts` implementation is extracted from `@arcium-hq/client` v0.8.5 under GPL-3.0-only.
