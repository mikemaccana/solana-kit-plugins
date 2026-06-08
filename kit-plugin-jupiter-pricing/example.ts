import { connect } from "solana-kite";
import { address } from "@solana/kit";
import { createKitePricingPlugin } from "./src/index.js";

const exampleWalletAddress = "dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8";

async function demonstratePricingPlugin() {
  console.log("Kite Jupiter Pricing Plugin Demo\n");

  const connection = connect("mainnet-beta");
  const pricingPlugin = createKitePricingPlugin({
    jupiterApiKey: process.env.JUPITER_API_KEY,
  });
  const client = pricingPlugin(connection);

  const walletAddress = address(exampleWalletAddress);

  console.log("1. Getting SOL price...");
  const solMint = "So11111111111111111111111111111111111111112";
  const solPrice = await client.getTokenPrice(solMint);
  if (solPrice) {
    console.log(`   SOL: ${client.formatUsdValue(solPrice.priceUsd)}\n`);
  }

  console.log("2. Getting multiple token prices...");
  const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const prices = await client.getTokenPrices([solMint, usdcMint]);
  for (const [mint, info] of prices) {
    console.log(`   ${info.symbol}: ${client.formatUsdValue(info.priceUsd)}`);
  }
  console.log();

  console.log("3. Calculating USD value for 1 SOL...");
  const oneSolInLamports = 1000000000n;
  const valueUsd = await client.getTokenValueInUsd(solMint, oneSolInLamports, 9);
  if (valueUsd) {
    console.log(`   1 SOL = ${client.formatUsdValue(valueUsd)}\n`);
  }

  console.log("4. Getting portfolio value...");
  const portfolioValue = await client.getPortfolioValue(walletAddress);
  console.log(`   Total: ${client.formatUsdValue(portfolioValue)}\n`);

  console.log("5. Getting portfolio breakdown...");
  const breakdown = await client.getPortfolioBreakdown(walletAddress);
  console.log(`   Total Value: ${client.formatUsdValue(breakdown.totalValueUsd)}`);
  console.log(`   Token Count: ${breakdown.tokenCount}`);
  console.log(`   Tokens without price: ${breakdown.tokensWithoutPrice}`);
  console.log("\n   Holdings:");
  for (const token of breakdown.tokens.slice(0, 5)) {
    const percentage = (token.valueUsd / breakdown.totalValueUsd) * 100;
    console.log(
      `     ${token.symbol.padEnd(10)} ${client.formatUsdValue(token.valueUsd).padStart(15)} (${percentage.toFixed(1)}%)`
    );
  }
  console.log();

  console.log("6. Getting top 3 holdings...");
  const topThree = await client.getTopHoldings(walletAddress, 3);
  for (const token of topThree) {
    console.log(`   ${token.symbol}: ${client.formatUsdValue(token.valueUsd)}`);
  }
  console.log();

  console.log("7. Converting 1 SOL to USDC equivalent...");
  const usdcAmount = await client.convertBetweenTokens(solMint, usdcMint, oneSolInLamports, 9);
  if (usdcAmount) {
    console.log(`   1 SOL ≈ ${Number(usdcAmount) / 1e6} USDC\n`);
  }

  console.log("8. Watching SOL price for 5 seconds...");
  let priceCheckCount = 0;
  const cleanup = client.watchTokenPrice(
    solMint,
    (error, price) => {
      priceCheckCount++;
      if (error) {
        console.error(`   Error: ${error.message}`);
        return;
      }
      console.log(`   Check ${priceCheckCount}: SOL = ${client.formatUsdValue(price!)}`);
    },
    2000
  );

  await new Promise((resolve) => setTimeout(resolve, 5000));
  cleanup();

  console.log("\nDemo complete!");
}

demonstratePricingPlugin().catch((error) => {
  console.error("Error running demo:", error);
  process.exit(1);
});
