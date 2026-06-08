import { connect } from "solana-kite";
import { createKitePythPlugin, PYTH_FEED_IDS, SOL_USD_PRICE_ACCOUNT } from "./src/index.js";

async function main() {
  console.log("Kite Pyth Plugin Example\n");

  const connection = connect("mainnet-beta");
  const { pyth } = createKitePythPlugin()(connection);

  // 1. Get a single price from Hermes
  console.log("1. SOL/USD price from Hermes:");
  const solFeed = await pyth.getPythPrice(PYTH_FEED_IDS.SOL_USD);
  if (solFeed) {
    console.log(`   Price:      $${solFeed.price.price.toFixed(4)}`);
    console.log(`   Confidence: ±$${solFeed.price.confidence.toFixed(4)}`);
    console.log(`   EMA:        $${solFeed.emaPrice.price.toFixed(4)}`);
    console.log(`   Published:  ${new Date(solFeed.price.publishTime * 1000).toISOString()}\n`);
  }

  // 2. Batch fetch multiple prices in one HTTP request
  console.log("2. Batch prices (SOL, BTC, ETH):");
  const feeds = await pyth.getPythPrices([PYTH_FEED_IDS.SOL_USD, PYTH_FEED_IDS.BTC_USD, PYTH_FEED_IDS.ETH_USD]);
  for (const [feedId, feed] of feeds) {
    const label = Object.entries(PYTH_FEED_IDS).find(([, id]) => id === feedId)?.[0] ?? feedId.slice(0, 8);
    console.log(`   ${label.padEnd(12)} $${feed.price.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }
  console.log();

  // 3. Read legacy on-chain push price account
  console.log("3. On-chain SOL/USD price account (legacy push oracle):");
  const onchainPrice = await pyth.getPythOnchainPrice(SOL_USD_PRICE_ACCOUNT);
  if (onchainPrice) {
    console.log(`   Price:  $${onchainPrice.price.toFixed(4)}`);
    console.log(`   Status: ${onchainPrice.status}`);
    console.log(`   Slot:   ${onchainPrice.slot}\n`);
  }

  // 4. Staleness check
  console.log("4. Staleness check (max 60 seconds):");
  const isStale = await pyth.isPythPriceStale(PYTH_FEED_IDS.SOL_USD, 60);
  console.log(`   SOL/USD is ${isStale ? "STALE" : "fresh"}\n`);

  // 5. Search feed catalogue
  console.log("5. Searching for BTC Crypto feeds:");
  const btcFeeds = await pyth.searchPythFeeds("BTC", "Crypto");
  for (const feed of btcFeeds.slice(0, 3)) {
    console.log(`   ${feed.attributes.symbol.padEnd(25)} ${feed.id.slice(0, 16)}...`);
  }
  console.log();

  // 6. Watch price updates
  console.log("6. Watching SOL/USD for 3 seconds (polling every second):");
  let updateCount = 0;
  const stopWatching = pyth.watchPythPrice(
    PYTH_FEED_IDS.SOL_USD,
    (error, feed) => {
      if (error) {
        console.error(`   Error: ${error.message}`);
        return;
      }
      if (feed) {
        updateCount++;
        console.log(`   Update ${updateCount}: $${feed.price.price.toFixed(4)}`);
      }
    },
    1000,
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));
  stopWatching();

  console.log("\nExample complete!");
  console.log("\nTo post price updates on-chain (pull oracle), use:");
  console.log("  const priceUpdateAccount = await pyth.postPythPriceUpdate(PYTH_FEED_IDS.SOL_USD, payer);");
  console.log("  // ... your program reads price from priceUpdateAccount ...");
  console.log("  await pyth.reclaimPythPriceUpdateRent(priceUpdateAccount, payer);");
}

main().catch(console.error);
