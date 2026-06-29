# kit-plugin-kite

A [Solana Kit](https://www.solanakit.com) plugin that adds [Solana Kite](https://solanakite.com)'s
high-level capabilities to a Kit client.

Kite runs on top of Kit and provides ergonomic helpers — `sendTransactionFromInstructions`, token
mint/transfer/burn, metadata, PDA derivation, balance watchers and more — that the lower-level
`@solana/kit` primitives leave to the caller. Exposing Kite as a Kit plugin lets those helpers
compose in a standard `createClient().use(...)` chain, and lets the capability-specific plugins
(Arcium, Pyth, Metaplex, TukTuk, …) build on top of it.

## Installation

```bash
npm install kit-plugin-kite solana-kite @solana/kit
```

## Usage

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";

const client = createClient().use(kite({ clusterNameOrURL: "devnet" }));

// The client now has the full Kite Connection surface:
const balance = await client.getLamportBalance(someAddress);
const signature = await client.sendTransactionFromInstructions({
  feePayer: wallet,
  instructions,
});
```

Because `kite()` is a standard Kit plugin, the capability-specific Kit plugins layer cleanly on top:

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { metaplex } from "kit-plugin-metaplex";
import { pyth } from "kit-plugin-pyth";

const client = createClient()
  .use(kite({ clusterNameOrURL: "mainnet" }))
  .use(metaplex())
  .use(pyth());

const metadata = await client.getTokenMetadata(someMint);
const price = await client.pyth.getPythPriceFeed("...");
```

> **Note:** `kite()` establishes the RPC and RPC-subscriptions transports from the supplied cluster
> configuration, so it is normally the first plugin in the chain. It is the Kit-plugin equivalent of
> Kite's own `connect()` entry point.

## Configuration

| Option              | Type     | Default      | Description                                                              |
| ------------------- | -------- | ------------ | ------------------------------------------------------------------------ |
| `clusterNameOrURL`  | `string` | `"localnet"` | Cluster name (e.g. `"mainnet"`, `"devnet"`) or an HTTP RPC URL.          |
| `webSocketURL`      | `string` | auto-derived | WebSocket URL for subscriptions. Required when using a custom HTTP URL.  |

## License

MIT
