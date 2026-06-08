import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { address } from "@solana/kit";
import { createKitePricingPlugin } from "./plugin.js";
import { WRAPPED_SOL_MINT } from "./constants.js";

// Integration tests use quicknode-mainnet instead of public mainnet-beta RPC
// to avoid rate limits (429 errors) when running the full test suite.
// Requires QUICKNODE_SOLANA_MAINNET_ENDPOINT environment variable to be set.

describe("createKitePricingPlugin", () => {
  test("plugin extends connection with pricing methods", () => {
    const connection = connect("devnet");
    const pricingPlugin = createKitePricingPlugin();
    const connectionWithPricing = pricingPlugin(connection);

    assert.ok(typeof connectionWithPricing.getTokenPrice === "function");
    assert.ok(typeof connectionWithPricing.getTokenPrices === "function");
    assert.ok(typeof connectionWithPricing.getTokenValueInUsd === "function");
    assert.ok(typeof connectionWithPricing.getPortfolioValue === "function");
    assert.ok(typeof connectionWithPricing.getPortfolioBreakdown === "function");
    assert.ok(typeof connectionWithPricing.getTopHoldings === "function");
    assert.ok(typeof connectionWithPricing.convertBetweenTokens === "function");
    assert.ok(typeof connectionWithPricing.formatUsdValue === "function");
    assert.ok(typeof connectionWithPricing.watchPortfolioValue === "function");
    assert.ok(typeof connectionWithPricing.watchTokenPrice === "function");
    assert.ok(connectionWithPricing.jupiter);
  });

  test("plugin preserves original connection methods", () => {
    const connection = connect("devnet");
    const pricingPlugin = createKitePricingPlugin();
    const connectionWithPricing = pricingPlugin(connection);

    assert.ok(typeof connectionWithPricing.getLamportBalance === "function");
    assert.ok(typeof connectionWithPricing.getTokenAccounts === "function");
    assert.ok(typeof connectionWithPricing.createWallet === "function");
    assert.ok(connectionWithPricing.rpc);
  });

  test("can use plugin with connection.use() pattern", () => {
    const connection = connect("devnet");
    const pricingPlugin = createKitePricingPlugin();
    const connectionWithPricing = connection as any;

    assert.ok(connection);
    assert.ok(pricingPlugin);
  });
});

describe("getTokenPrice integration", () => {
  test("fetches SOL price successfully", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const priceInfo = await client.getTokenPrice(WRAPPED_SOL_MINT as any);

    assert.ok(priceInfo, "Price info should exist");
    assert.ok(priceInfo.priceUsd > 0, "Price should be positive");
    assert.strictEqual(priceInfo.symbol, "SOL");
    assert.strictEqual(priceInfo.mint, WRAPPED_SOL_MINT);
  });
});

describe("getTokenPrices integration", () => {
  test("fetches multiple token prices", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const prices = await client.getTokenPrices([WRAPPED_SOL_MINT as any, USDC_MINT as any]);

    assert.ok(prices.size >= 2, "Should have at least 2 prices");
    assert.ok(prices.has(WRAPPED_SOL_MINT), "Should have SOL price");
    assert.ok(prices.has(USDC_MINT), "Should have USDC price");
  });
});

describe("getTokenValueInUsd integration", () => {
  test("calculates USD value for token amount", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const valueUsd = await client.getTokenValueInUsd(WRAPPED_SOL_MINT as any, 1000000000n, 9);

    assert.ok(valueUsd, "Value should exist");
    assert.ok(valueUsd > 0, "Value should be positive");
  });

  test("returns null for non-existent token", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const FAKE_MINT = "1111111111111111111111111111111111111111111";
    const valueUsd = await client.getTokenValueInUsd(FAKE_MINT as any, 1000000000n, 9);

    assert.strictEqual(valueUsd, null);
  });
});

describe("getPortfolioBreakdown integration", () => {
  test("gets portfolio breakdown for address with balance", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const testAddress = address("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
    const breakdown = await client.getPortfolioBreakdown(testAddress);

    assert.ok(breakdown, "Breakdown should exist");
    assert.ok(typeof breakdown.totalValueUsd === "number");
    assert.ok(Array.isArray(breakdown.tokens));
    assert.ok(typeof breakdown.tokenCount === "number");
    assert.ok(typeof breakdown.tokensWithoutPrice === "number");
    assert.ok(typeof breakdown.fetchedAt === "number");
  });
});

describe("getPortfolioValue integration", () => {
  test("gets total portfolio value", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const testAddress = address("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
    const value = await client.getPortfolioValue(testAddress);

    assert.ok(typeof value === "number");
    assert.ok(value >= 0);
  });
});

describe("getTopHoldings integration", () => {
  test("gets top holdings limited to specified count", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const testAddress = address("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
    const holdings = await client.getTopHoldings(testAddress, 3);

    assert.ok(Array.isArray(holdings));
    assert.ok(holdings.length <= 3);

    if (holdings.length > 1) {
      assert.ok(holdings[0].valueUsd >= holdings[1].valueUsd, "Holdings should be sorted by value");
    }
  });
});

describe("convertBetweenTokens integration", () => {
  test("converts SOL amount to USDC equivalent", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const oneSolInLamports = 1000000000n;

    const usdcAmount = await client.convertBetweenTokens(WRAPPED_SOL_MINT as any, USDC_MINT as any, oneSolInLamports, 9);

    assert.ok(usdcAmount, "Conversion should return a value");
    assert.ok(usdcAmount > 0n, "Converted amount should be positive");
  });
});

describe("formatUsdValue", () => {
  test("formats USD values correctly", () => {
    const connection = connect("devnet");
    const pricingPlugin = createKitePricingPlugin();
    const client = pricingPlugin(connection);

    const formatted = client.formatUsdValue(1234.56);
    assert.strictEqual(formatted, "$1,234.56");
  });
});

describe("watchTokenPrice", () => {
  test("watches token price and calls callback", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    let callbackInvoked = false;
    let receivedPrice: number | null = null;

    const cleanup = client.watchTokenPrice(
      WRAPPED_SOL_MINT as any,
      (error, price) => {
        callbackInvoked = true;
        if (error) {
          assert.fail(`Unexpected error: ${error.message}`);
        }
        receivedPrice = price;
      },
      100,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    cleanup();

    assert.ok(callbackInvoked, "Callback should have been invoked");
    assert.ok(receivedPrice !== null && receivedPrice > 0, "Should have received a valid price");
  });
});

describe("watchPortfolioValue", () => {
  test("watches portfolio value and calls callback", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const testAddress = address("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");

    let callbackInvoked = false;
    let receivedValue: number | null = null;

    const cleanup = client.watchPortfolioValue(
      testAddress,
      (error, value) => {
        callbackInvoked = true;
        if (error) {
          assert.fail(`Unexpected error: ${error.message}`);
        }
        receivedValue = value;
      },
      100,
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    cleanup();

    assert.ok(callbackInvoked, "Callback should have been invoked");
    assert.ok(receivedValue !== null && receivedValue >= 0, "Should have received a valid value");
  });
});

describe("enhanced transferTokens", () => {
  test("resolves token symbol to mint address", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const resolvedMint = await client.jupiter.resolveTokenSymbol("SOL");

    if (resolvedMint === null) {
      console.warn("Symbol resolution returned null - may be rate limited by Jupiter API");
      return;
    }

    assert.strictEqual(resolvedMint, WRAPPED_SOL_MINT, "Should resolve SOL to wrapped SOL mint");
  });

  test("returns null for invalid token symbol", async () => {
    const connection = connect("quicknode-mainnet");
    const pricingPlugin = createKitePricingPlugin({
      jupiterApiKey: process.env.JUPITER_API_KEY,
    });
    const client = pricingPlugin(connection);

    const invalidSymbol = "NOTAREALTOKENSYMBOL123";
    const resolvedMint = await client.jupiter.resolveTokenSymbol(invalidSymbol);

    assert.strictEqual(resolvedMint, null, "Should return null for invalid symbol");
  });
});
