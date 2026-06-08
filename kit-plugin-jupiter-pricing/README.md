# Solana Kite Pricing

Jupiter Price API plugin for Solana Kite providing price-aware token operations.

This plugin extends Solana Kite with price data from Jupiter, enabling you to work with USD values, calculate portfolio values, monitor prices, and convert between tokens.

## Features

- **Price Queries**: Get current prices for any SPL token
- **Portfolio Valuation**: Calculate total portfolio value in USD
- **Token Conversion**: Convert amounts between different tokens using current prices
- **Price Monitoring**: Watch token prices and portfolio values in real-time
- **Caching**: Built-in price caching to respect rate limits
- **Type-Safe**: Full TypeScript support with comprehensive types

## Installation

```bash
npm install kit-plugin-jupiter-pricing solana-kite @solana/kit
```

## Setup

Get a Jupiter API key at https://portal.jup.ag (optional but recommended for higher rate limits).

```bash
export JUPITER_API_KEY="your-api-key-here"
```

## Quick Start

### Basic Usage with createClient().use(kite())

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { jupiterPricing } from "kit-plugin-jupiter-pricing";

const connection = createClient()
  .use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(jupiterPricing({ jupiterApiKey: process.env.JUPITER_API_KEY }));

const solPrice = await connection.getTokenPrice("So11111111111111111111111111111111111111112");
console.log(`SOL price: $${solPrice.priceUsd}`);
```

### Configuration options

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { jupiterPricing } from "kit-plugin-jupiter-pricing";

const connection = createClient()
  .use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(jupiterPricing({
    jupiterApiKey: process.env.JUPITER_API_KEY,
    cacheTimeMs: 60000,
  }));

const portfolioValue = await connection.getPortfolioValue(someAddress);
console.log(`Portfolio value: $${portfolioValue.toFixed(2)}`);
```

## API Reference

### Configuration

```typescript
interface KitePricingConfig {
  jupiterApiKey?: string;
  cacheTimeMs?: number;
  vsToken?: string;
}
```

- `jupiterApiKey`: Optional Jupiter API key for higher rate limits
- `cacheTimeMs`: Cache duration in milliseconds (default: 60000)
- `vsToken`: Quote token for prices (default: "USDC")

### Methods

#### `getTokenPrice(mint: Address): Promise<TokenPriceInfo | null>`

Get the current price for a single token.

```typescript
const solMint = "So11111111111111111111111111111111111111112";
const priceInfo = await connection.getTokenPrice(solMint);
if (priceInfo) {
  console.log(`${priceInfo.symbol}: $${priceInfo.priceUsd}`);
}
```

#### `getTokenPrices(mints: Array<Address>): Promise<Map<string, TokenPriceInfo>>`

Get prices for multiple tokens in a single request.

```typescript
const mints = [
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
];
const prices = await connection.getTokenPrices(mints);
for (const [mint, info] of prices) {
  console.log(`${info.symbol}: $${info.priceUsd}`);
}
```

#### `getTokenValueInUsd(mint: Address, amount: bigint, decimals: number): Promise<number | null>`

Calculate the USD value of a specific token amount.

```typescript
const solMint = "So11111111111111111111111111111111111111112";
const oneSolInLamports = 1000000000n;
const valueUsd = await connection.getTokenValueInUsd(solMint, oneSolInLamports, 9);
console.log(`1 SOL = $${valueUsd}`);
```

#### `getPortfolioValue(address: Address): Promise<number>`

Get the total USD value of all tokens in a wallet.

```typescript
import { address } from "@solana/kit";

const walletAddress = address("YourWalletAddressHere");
const totalValue = await connection.getPortfolioValue(walletAddress);
console.log(`Total portfolio value: ${connection.formatUsdValue(totalValue)}`);
```

#### `getPortfolioBreakdown(address: Address): Promise<PortfolioBreakdown>`

Get detailed breakdown of all tokens in a wallet with their values.

```typescript
const breakdown = await connection.getPortfolioBreakdown(walletAddress);
console.log(`Total: ${connection.formatUsdValue(breakdown.totalValueUsd)}`);
console.log(`\nTokens (${breakdown.tokenCount}):`);
for (const token of breakdown.tokens) {
  console.log(`  ${token.symbol}: ${connection.formatUsdValue(token.valueUsd)}`);
}
```

#### `getTopHoldings(address: Address, limit: number): Promise<Array<PortfolioToken>>`

Get the top N tokens by value in a wallet.

```typescript
const topThree = await connection.getTopHoldings(walletAddress, 3);
console.log("Top 3 holdings:");
for (const token of topThree) {
  console.log(`  ${token.symbol}: ${connection.formatUsdValue(token.valueUsd)}`);
}
```

#### `convertBetweenTokens(fromMint: Address, toMint: Address, amount: bigint, decimals: number): Promise<bigint | null>`

Convert an amount from one token to another using current prices.

```typescript
const solMint = "So11111111111111111111111111111111111111112";
const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const oneSolInLamports = 1000000000n;

const usdcAmount = await connection.convertBetweenTokens(
  solMint,
  usdcMint,
  oneSolInLamports,
  9
);
console.log(`1 SOL = ${Number(usdcAmount) / 1e6} USDC`);
```

#### `transferTokens(params): Promise<string>`

Enhanced version of Kite's `transferTokens` that supports token symbols and USD values. When the pricing plugin is applied, you can send tokens by symbol name (like "SOL", "USDC") and specify amounts in USD instead of base units.

```typescript
import { address } from "@solana/kit";

const sender = await connection.createWallet({ airdropAmount: 1000000000n });
const recipient = address("RecipientAddressHere");

// Using token symbol with USD value
const signature = await connection.transferTokens({
  sender,
  destination: recipient,
  token: "FART",
  usdValue: 100,
});

console.log(`Sent $100 worth of FARTCOIN: ${signature}`);

// Using token symbol with amount (in base units)
const signature2 = await connection.transferTokens({
  sender,
  destination: recipient,
  token: "SOL",
  amount: 1000000000n, // 1 SOL in lamports
});

// Or use the full mint address with USD value
const signature3 = await connection.transferTokens({
  sender,
  destination: recipient,
  token: "FARTcoinMintAddressHere",
  usdValue: 50,
});
```

Parameters:
- `sender: TransactionSendingSigner` - The wallet sending the tokens
- `destination: Address` - The recipient address
- `token: Address | string` - Token symbol (e.g., "SOL", "USDC") or full mint address
- `amount: bigint` - Amount to send in base units (mutually exclusive with `usdValue`)
- `usdValue: number` - USD value to send (e.g., 100 for $100, mutually exclusive with `amount`)
- `maximumClientSideRetries?: number` - Optional retry count
- `abortSignal?: AbortSignal` - Optional abort signal
- `useTokenExtensions?: boolean` - Use Token Extensions program (default: true)

**Note**: You must provide either `amount` or `usdValue`, but not both.

#### `formatUsdValue(value: number): string`

Format a number as a USD currency string.

```typescript
console.log(connection.formatUsdValue(1234.56)); // "$1,234.56"
console.log(connection.formatUsdValue(0.00123)); // "$1.23e-3"
console.log(connection.formatUsdValue(0.1234)); // "$0.1234"
```

#### `watchTokenPrice(mint: Address, callback: PriceWatchCallback, intervalMs?: number): () => void`

Monitor a token's price with a callback.

```typescript
const solMint = "So11111111111111111111111111111111111111112";

const cleanup = connection.watchTokenPrice(
  solMint,
  (error, price) => {
    if (error) {
      console.error("Price fetch error:", error);
      return;
    }
    console.log(`Current SOL price: $${price}`);
  },
  30000 // Poll every 30 seconds
);

// Stop watching after 5 minutes
setTimeout(cleanup, 5 * 60 * 1000);
```

#### `watchPortfolioValue(address: Address, callback: PortfolioWatchCallback, intervalMs?: number): () => void`

Monitor a wallet's total portfolio value.

```typescript
const cleanup = connection.watchPortfolioValue(
  walletAddress,
  (error, value) => {
    if (error) {
      console.error("Portfolio fetch error:", error);
      return;
    }
    console.log(`Portfolio value: ${connection.formatUsdValue(value)}`);
  },
  60000 // Poll every minute
);

setTimeout(cleanup, 60 * 60 * 1000);
```

## Types

### TokenPriceInfo

```typescript
interface TokenPriceInfo {
  mint: Address;
  symbol: string;
  priceUsd: number;
  fetchedAt: number;
}
```

### PortfolioToken

```typescript
interface PortfolioToken {
  mint: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}
```

### PortfolioBreakdown

```typescript
interface PortfolioBreakdown {
  tokens: Array<PortfolioToken>;
  totalValueUsd: number;
  tokenCount: number;
  tokensWithoutPrice: number;
  fetchedAt: number;
}
```

## Examples

### Portfolio Dashboard

```typescript
import { address } from "@solana/kit";
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { jupiterPricing } from "kit-plugin-jupiter-pricing";

const connection = createClient()
  .use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(jupiterPricing({ jupiterApiKey: process.env.JUPITER_API_KEY }));

const walletAddress = address("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");

async function displayPortfolio() {
  const breakdown = await connection.getPortfolioBreakdown(walletAddress);

  console.log(`\nPortfolio Value: ${connection.formatUsdValue(breakdown.totalValueUsd)}`);
  console.log(`Total Tokens: ${breakdown.tokenCount}`);

  if (breakdown.tokensWithoutPrice > 0) {
    console.log(`Tokens without price data: ${breakdown.tokensWithoutPrice}`);
  }

  console.log("\nHoldings:");
  for (const token of breakdown.tokens) {
    const percentage = (token.valueUsd / breakdown.totalValueUsd) * 100;
    console.log(
      `  ${token.symbol.padEnd(10)} ${connection.formatUsdValue(token.valueUsd).padStart(15)} (${percentage.toFixed(1)}%)`
    );
  }
}

displayPortfolio();
```

### Price Alert Bot

```typescript
const solMint = "So11111111111111111111111111111111111111112";
const targetPrice = 150;
let alerted = false;

const cleanup = connection.watchTokenPrice(
  solMint,
  (error, price) => {
    if (error || !price) return;

    if (price > targetPrice && !alerted) {
      console.log(`ALERT: SOL price hit $${price}!`);
      alerted = true;
      cleanup();
    }
  },
  10000
);
```

### Token Swap Calculator

```typescript
async function calculateSwap(fromMint: string, toMint: string, amount: bigint) {
  const prices = await connection.getTokenPrices([fromMint, toMint]);
  const fromPrice = prices.get(fromMint);
  const toPrice = prices.get(toMint);

  if (!fromPrice || !toPrice) {
    throw new Error("Could not fetch prices");
  }

  const toAmount = await connection.convertBetweenTokens(
    fromMint,
    toMint,
    amount,
    9
  );

  console.log(`${fromPrice.symbol} price: $${fromPrice.priceUsd}`);
  console.log(`${toPrice.symbol} price: $${toPrice.priceUsd}`);
  console.log(`You would receive: ${Number(toAmount) / 1e9} ${toPrice.symbol}`);
}
```

### Send USD-Valued Transfers

The pricing plugin enhances Kite's `transferTokens` to support token symbols and USD values - perfect for "send $100 worth of X" operations.

```typescript
import { address } from "@solana/kit";

const sender = await connection.loadWalletFromEnvironment("WALLET_SECRET_KEY");
const recipient = address("RecipientAddressHere");

// Use token symbols with USD values - much cleaner!
const signature = await connection.transferTokens({
  sender,
  destination: recipient,
  token: "FART",
  usdValue: 100,
});

console.log(`Sent $100 worth of FARTCOIN!`);
console.log(`Transaction: ${signature}`);

// Works with any token symbol from Jupiter's verified list
const solSignature = await connection.transferTokens({
  sender,
  destination: recipient,
  token: "SOL",
  usdValue: 50,
});

console.log(`Sent $50 worth of SOL: ${solSignature}`);

// Can also send multiple different tokens
await connection.transferTokens({
  sender,
  destination: recipient,
  token: "USDC",
  usdValue: 25,
});

await connection.transferTokens({
  sender,
  destination: recipient,
  token: "BONK",
  usdValue: 10,
});
```

## Caching

The plugin includes intelligent caching to minimize API calls:

- Prices are cached for the configured duration (default 60 seconds)
- Token symbols are cached indefinitely
- Cache can be cleared manually: `connection.jupiter.clearCache()`

## Testing

```bash
npm test
```

Tests include both unit tests and integration tests. Integration tests require network access and may need a Jupiter API key for higher rate limits.

## License

MIT

## Credits

Built for Solana Kite by the Kite community. Uses Jupiter's Price API v3.
