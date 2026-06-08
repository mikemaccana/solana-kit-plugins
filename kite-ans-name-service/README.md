# Solana Kite ANS

AllDomains Name Service (ANS) plugin for Solana Kite enabling `.abc` and custom TLD domain name resolution.

## Features

- **Domain Resolution**: Resolve ANS domains (`.abc`, `.bonk`, `.poor`, etc.) to Solana addresses
- **Pure Solana Kit**: Zero web3.js dependencies - built entirely with @solana/kit
- **Transparent Enhancement**: Works with existing Kite methods
- **Intelligent Caching**: Built-in caching (default: 1 hour)
- **Type-Safe**: Full TypeScript support

## Installation

```bash
npm install solana-kite-ans-name-service solana-kite @solana/kit
```

## Quick Start

```typescript
import { connect } from "solana-kite";
import { createKiteANSNameServicePlugin } from "solana-kite-ans-name-service";

// Using .addPlugin() method (recommended)
const connection = connect("mainnet-beta").addPlugin(createKiteANSNameServicePlugin());

const address = await connection.getAddressForANSName("example.abc");
console.log(`Resolved address: ${address}`);
```

**Alternative: Manual composition**

```typescript
const ansPlugin = createKiteANSNameServicePlugin();
const connection = ansPlugin(connect("mainnet-beta"));
```

## API

### `getAddressForANSName(nameOrAddress: string): Promise<Address>`

Resolve an ANS domain to address.

```typescript
const address = await connection.getAddressForANSName("example.abc");
```

### `getANSNamesForAddress(address: Address): Promise<Array<string>>`

Get ANS domains for an address (returns empty array - full implementation coming soon).

## Configuration

```typescript
const connection = connect("mainnet-beta").addPlugin(
  createKiteANSNameServicePlugin({
    cacheTime: 3600000, // 1 hour (default)
    cluster: "mainnet-beta", // ANS cluster (default)
  })
);
```

## Composing with Other Plugins

```typescript
const connection = connect("mainnet-beta")
  .addPlugin(createKiteJupiterPricingPlugin({ jupiterApiKey }))
  .addPlugin(createKiteANSNameServicePlugin());

await connection.transferTokens({
  sender,
  destination: "alice.abc", // ANS resolution
  token: "BONK", // Symbol resolution
  usdValue: 100, // USD conversion
});
```

## Implementation

Pure Solana Kit implementation using:
- `@solana/kit` for PDA derivation and addresses
- `@solana/codecs` for base58 encoding/decoding
- `node:crypto` for SHA256 hashing
- `solana-kite` for RPC calls

**Zero web3.js dependencies** ✅

## License

MIT
