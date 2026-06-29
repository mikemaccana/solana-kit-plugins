# kit-plugin-litesvm

Run Solana Kit plugins against an in-process [LiteSVM](https://github.com/LiteSVM/litesvm) for
fast, network-free integration tests.

The Kit plugins in this repo reach the chain through a `Connection` (from solana-kite, a JSON-RPC client).
LiteSVM is an in-process SVM with no JSON-RPC server, so this package provides a small RPC→LiteSVM
transport and exposes the result as a `Connection`. You get the real SVM for test setup
(loading programs, injecting accounts) and a connection the plugins can read through.

## Installation

```bash
npm install -D kit-plugin-litesvm
```

## Usage

```typescript
import { connectLiteSvm } from "kit-plugin-litesvm";
import { metaplex } from "kit-plugin-metaplex";
import { METADATA_PROGRAM_ID } from "kit-plugin-metaplex";

const { svm, connection } = connectLiteSvm();

// Load a real program (fetched from mainnet) into the in-process validator:
svm.addProgramFromFile(METADATA_PROGRAM_ID, "tests/fixtures/mpl_token_metadata.so");

// Set up state directly on the SVM:
svm.setAccount({ address, data, executable: false, lamports, programAddress, space });

// Exercise the plugin's read paths through the connection:
const client = metaplex()(connection);
const tokenMetadata = await client.getMetaplexMetadata(mint);
```

## What the transport implements

The transport answers the **read** methods the connection and the plugins use:
`getAccountInfo`, `getMultipleAccounts`, `getBalance`, `getLatestBlockhash`, and
`getMinimumBalanceForRentExemption`.

Set up state with the `svm` handle directly (`setAccount`, `airdrop`, `sendTransaction`) rather
than sending through the connection — LiteSVM executes transactions synchronously and has no subscription
endpoint for the connection's send-and-confirm path. Reads then flow through the plugin under test.

## License

MIT
