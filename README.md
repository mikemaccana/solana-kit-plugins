# solana-kit-plugins

A directory of [Solana Kit](https://www.solanakit.com) plugins, including
[Solana Kite](https://solanakite.com) itself packaged as a Kit plugin.

Solana Kit (`@solana/kit` v6+) ships a small plugin system: you start from
`createClient()` and chain `.use(...)` to layer on capabilities. Kite — the ergonomic
layer that adds wallets, token operations, `sendTransactionFromInstructions`, PDA helpers
and more on top of Kit — is exposed here as the `kite()` plugin, and the remaining plugins
build on that capability.

## The layering

```ts
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { metaplex } from "kit-plugin-metaplex";
import { pyth } from "kit-plugin-pyth";

const client = createClient()
  .use(kite({ clusterNameOrURL: "mainnet" })) // 1. Kite's capabilities (the base layer)
  .use(metaplex())                            // 2. plugins that require the Kite capability
  .use(pyth());

const tokenMetadata = await client.getTokenMetadata(mint);
const priceFeed = await client.pyth.getPythPriceFeed(feedId);
```

Each plugin declares its requirements with a TypeScript generic (`<T extends Connection>`),
so applying them in the wrong order is a compile error. Kite's classic `connect("mainnet")`
entry point still works and is equivalent to `createClient().use(kite(...))`.

## Plugins

| Package | Factory | Adds |
| --- | --- | --- |
| [`kit-plugin-kite`](./kit-plugin-kite) | `kite()` | Kite's connection capabilities (base layer) |
| [`kit-plugin-arcium`](./kit-plugin-arcium) | `arcium()` | `client.arcium` — Arcium confidential computing (MXE) |
| [`kit-plugin-pyth`](./kit-plugin-pyth) | `pyth()` | `client.pyth` — Pyth Network oracle price feeds |
| [`kit-plugin-metaplex`](./kit-plugin-metaplex) | `metaplex()` | token metadata (Metaplex Token Metadata + Token-2022) |
| [`kit-plugin-tuktuk-task-scheduler`](./kit-plugin-tuktuk-task-scheduler) | `tuktukTaskScheduler()` | `client.tuktuk` — scheduled / recurring transactions |
| [`kit-plugin-jupiter-pricing`](./kit-plugin-jupiter-pricing) | `jupiterPricing()` | `client.jupiter` — Jupiter pricing, portfolio valuation |
| [`kit-plugin-squads-multisig`](./kit-plugin-squads-multisig) | `squadsMultisig()` | `client.squads` — Squads multisig |
| [`kit-plugin-ans-name-service`](./kit-plugin-ans-name-service) | `ansNameService()` | `client.ans` — AllDomains name service resolution |
| [`kit-plugin-switchboard`](./kit-plugin-switchboard) | `switchboard()` | `client.switchboard` — Switchboard oracle feeds (read-only) |

Each plugin keeps a deprecated `createKite*Plugin` alias for backward compatibility; prefer
the capability-named factory above.

## Working on a plugin

Every plugin is an independent npm package:

```bash
cd kit-plugin-<name>
npm install
npm run build       # tsc
npm run test:ci     # offline tests (no network) — what CI runs
npm test            # full suite, including network/integration tests
```

### Generated clients (Codama)

Plugins that wrap an on-chain program (`metaplex`, `squads-multisig`,
`tuktuk-task-scheduler`) keep the program IDL under `idls/` and generate their typed client
into `src/generated` with [Codama](https://github.com/codama-idl/codama):

```bash
npm run generate    # regenerates src/generated from idls/
```

The checked-in client is the output of `npm run generate`, so it is reproducible rather than a
black box. CI re-runs the generator and fails on any drift from the committed client.

## Continuous integration

Each plugin has its own GitHub Actions workflow under `.github/workflows/`, path-filtered to
that plugin's directory, so a change to one plugin only builds and tests that plugin. Plugins
with generated clients additionally verify the checked-in client still matches its IDL.

## Other directories

`kite-rust` and `kite-website` are committed as git submodule references and are not part of
the TypeScript plugin set.

## License

MIT
