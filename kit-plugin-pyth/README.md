# kit-plugin-pyth

Pyth Network oracle plugin for [Solana Kit](https://www.solanakit.com). Adds a `pyth`
namespace to the client for reading Pyth price feeds via the Hermes API and onchain price
accounts, and for posting pull-oracle price updates.

Layers on the [`kite()`](../kit-plugin-kite) capability, so apply
[`kite()`](../kit-plugin-kite) first.

## Installation

```bash
npm install kit-plugin-pyth kit-plugin-kite solana-kite @solana/kit
```

## Quick Start

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { pyth } from "kit-plugin-pyth";
import { PYTH_FEED_IDS } from "kit-plugin-pyth";

const connection = createClient()
  .use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(pyth());

// Latest SOL/USD price feed (spot price + EMA) from Hermes
const priceFeed = await connection.pyth.getPythPriceFeed(PYTH_FEED_IDS.SOL_USD);
console.log(`SOL/USD: $${priceFeed.price.price}`);
```

## Methods

All methods live under the `pyth` namespace on the client.

| Method | Description |
| --- | --- |
| `getPythPriceFeed(feedId)` | Fetch the latest `PythPriceFeed` (spot + EMA price) for one feed from Hermes. |
| `getPythPriceFeeds(feedIds)` | Fetch multiple feeds in a single request. |
| `getPythOnchainPrice(priceAccountAddress)` | Read a price directly from an onchain Pyth price account. |
| `isPythPriceStale(feedId, maxAgeSeconds)` | Returns `true` if the feed's last publish time exceeds `maxAgeSeconds`. |
| `searchPythFeeds(query, assetType?)` | Search Pyth's feed catalogue by name or symbol. |
| `watchPythPriceFeed(feedId, callback, intervalMs?)` | Poll a feed and invoke `callback` on each update. Returns a stop function. |
| `postPythPriceUpdate(feedId, payer)` | Post a single pull-oracle price update onchain; returns the temporary `PriceUpdateV2` account address. |
| `postPythPriceUpdates(feedIds, payer)` | Post multiple price updates (one transaction per feed). |
| `reclaimPythPriceUpdateRent(priceUpdateAccount, payer)` | Close a posted price-update account and recover its rent. |

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `hermesUrl` | `string` | `https://hermes.pyth.network` | Base URL for the Pyth Hermes API. |

## License

MIT
