# kit-plugin-switchboard

Read-only [Switchboard On-Demand](https://docs.switchboard.xyz/) oracle plugin for Solana Kit.

This plugin extends a Solana Kit client (layered on the [`kite()`](../kit-plugin-kite) capability)
with helpers to read Switchboard On-Demand price/feed values directly from on-chain `PullFeedAccountData` accounts.

It is **read-only**: it decodes the aggregated feed result from chain and never sends transactions.

## Features

- **On-chain feed reads**: Decode the aggregated `CurrentResult` of any Switchboard On-Demand pull feed account
- **Batch reads**: Fetch and decode multiple feed accounts at once
- **Pure decoder**: `parseSwitchboardFeedAccountData()` is a network-free function you can unit-test against captured bytes
- **Type-safe**: Full TypeScript support, no web3.js dependency (uses `@solana/kit` address/codec utilities)

## Installation

```bash
npm install kit-plugin-switchboard solana-kite @solana/kit
```

## Usage

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { switchboard } from "kit-plugin-switchboard";
import { address } from "@solana/kit";

const client = createClient()
  .use(kite({ clusterNameOrURL: "mainnet" }))
  .use(switchboard());

// Read a single feed value.
// NOTE: the feed account address is created by whoever deployed the feed -
// look yours up in the Switchboard Explorer (https://explorer.switchboard.xyz).
const feedAddress = address("YourSwitchboardFeedAccountAddressHere");
const feed = await client.switchboard.getFeedValue(feedAddress);

if (feed) {
  console.log(`Value: ${feed.value}`);            // float (rawValue / 10^18)
  console.log(`Raw:   ${feed.valueRaw}`);          // exact on-chain i128 (scaled by 10^18)
  console.log(`Slot:  ${feed.slot}`);
  console.log(`Updated at: ${feed.lastUpdatedAt}`);
}

// Read several feeds at once.
const feeds = await client.switchboard.getFeedValues([feedAddress]);
```

## How values are scaled

Switchboard On-Demand stores result values as fixed-point signed 128-bit integers scaled by `10^18`.
`getFeedValue()` returns both the converted `value` (a JS number) and the exact `valueRaw` (a `bigint`).
For high-magnitude or high-precision use cases, prefer `valueRaw` together with `SWITCHBOARD_DECIMAL_SCALE`.

## API

### `switchboard(config?)`

Factory returning the Kit plugin. `config.programId` optionally overrides the Switchboard On-Demand
program ID (defaults to the Solana mainnet program ID).

### `client.switchboard.getFeedValue(feedAddress)`

Reads and decodes a single pull feed account. Returns a `SwitchboardFeedValue` or `null`.

### `client.switchboard.getFeedValues(feedAddresses)`

Reads and decodes multiple pull feed accounts. Returns a `Map<Address, SwitchboardFeedValue>`
(addresses that cannot be decoded are omitted).

### `parseSwitchboardFeedAccountData(data, feedAddress)`

Pure (network-free) decoder. Takes raw account bytes (including the 8-byte anchor discriminator)
and returns a `SwitchboardFeedValue` or `null`.

## Account layout source

The decoder layout is verified against the official Switchboard SDK:
[`switchboard-xyz/solana-sdk` `src/on_demand/accounts/pull_feed.rs`](https://github.com/switchboard-xyz/solana-sdk/blob/main/src/on_demand/accounts/pull_feed.rs)
(`PullFeedAccountData` / `CurrentResult`). Program IDs are from the
[Switchboard documentation](https://docs.switchboard.xyz/).

- Solana mainnet/devnet program ID: `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`

## License

MIT
