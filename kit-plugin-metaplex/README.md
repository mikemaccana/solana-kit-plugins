# Solana Kite Metaplex

Metaplex token metadata plugin for Solana Kit supporting both Metaplex Token Metadata and Token-2022 metadata extension.

This plugin intelligently handles BOTH metadata standards, automatically detecting which system a token uses and returning the appropriate metadata.

## Features

- **Dual Metadata Support**: Automatically checks both Metaplex Token Metadata AND Token-2022 metadata extension
- **Smart Detection**: Prefers Metaplex by default (more common for NFTs), falls back to Token-2022
- **Metaplex-Specific Fields**: Access creators, collections, royalties (sellerFeeBasisPoints)
- **Off-Chain Data**: Fetch and parse JSON metadata from URIs
- **Batch Operations**: Get metadata for multiple tokens in parallel
- **Intelligent Caching**: Built-in caching to minimize RPC calls
- **Type-Safe**: Full TypeScript support with proper types for both standards
- **Zero web3.js**: Built entirely on Solana Kit

## Installation

```bash
npm install kit-plugin-metaplex solana-kite @solana/kit
```

## Quick Start

### Basic Usage

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { metaplex } from "kit-plugin-metaplex";
import { address } from "@solana/kit";

const connection = createClient().use(kite({ clusterNameOrURL: "mainnet-beta" })).use(metaplex());

const mintAddress = address("YourTokenMintAddress...");

// Automatically checks both Metaplex and Token-2022
const metadata = await connection.getTokenMetadata(mintAddress);

if (metadata) {
  console.log(`Source: ${metadata.source}`); // "metaplex" or "token-2022"
  console.log(`Name: ${metadata.name}`);
  console.log(`Symbol: ${metadata.symbol}`);
  console.log(`URI: ${metadata.uri}`);

  // Metaplex-specific fields (only present if source is "metaplex")
  if (metadata.source === "metaplex") {
    console.log(`Royalties: ${metadata.sellerFeeBasisPoints} basis points`);

    if (metadata.creators) {
      console.log("Creators:");
      for (const creator of metadata.creators) {
        console.log(`  ${creator.address}: ${creator.share}% ${creator.verified ? "✓" : "✗"}`);
      }
    }

    if (metadata.collection) {
      console.log(`Collection: ${metadata.collection.key} ${metadata.collection.verified ? "✓" : "✗"}`);
    }
  }
}
```

### Get Complete NFT Data

```typescript
// Get both on-chain and off-chain metadata
const complete = await connection.getCompleteMetadata(nftMintAddress);

if (complete) {
  // On-chain data
  console.log(`Name: ${complete.onChain.name}`);
  console.log(`Symbol: ${complete.onChain.symbol}`);
  console.log(`Source: ${complete.onChain.source}`);

  // Off-chain data (from JSON URI)
  console.log(`Description: ${complete.offChain.description}`);
  console.log(`Image: ${complete.offChain.image}`);

  if (complete.offChain.attributes) {
    console.log("\nAttributes:");
    for (const attr of complete.offChain.attributes) {
      console.log(`  ${attr.traitType}: ${attr.value}`);
    }
  }
}
```

### Batch Operations

```typescript
import { address } from "@solana/kit";

const mints = [
  address("Mint1..."),
  address("Mint2..."),
  address("Mint3..."),
];

const metadataMap = await connection.getBatchTokenMetadata(mints);

for (const [mint, metadata] of metadataMap) {
  if (metadata) {
    console.log(`${mint}: ${metadata.name} (${metadata.source})`);
  } else {
    console.log(`${mint}: No metadata found`);
  }
}
```

## API Reference

### Configuration

```typescript
interface MetaplexConfig {
  cluster?: string;              // Default: inherits from connection
  cacheTime?: number;            // Default: 3600000 (1 hour)
  preferMetaplex?: boolean;      // Default: true (check Metaplex first)
}
```

### Methods

#### `getTokenMetadata(mintAddress, useCache?): Promise<TokenMetadata | null>`

Intelligently gets token metadata, checking both Metaplex and Token-2022 sources.

```typescript
const metadata = await connection.getTokenMetadata(mintAddress);
const freshMetadata = await connection.getTokenMetadata(mintAddress, false); // Skip cache
```

**Returns**: `TokenMetadata` object with a `source` field indicating which system was used.

```typescript
interface TokenMetadata {
  source: "metaplex" | "token-2022";
  name: string;
  symbol: string;
  uri: string;
  mint: Address;

  // Metaplex-specific fields (only present if source is "metaplex")
  sellerFeeBasisPoints?: number;
  creators?: Array<Creator>;
  collection?: Collection;
  updateAuthority?: Address;
  isMutable?: boolean;
  primarySaleHappened?: boolean;

  // Token-2022 specific (only present if source is "token-2022")
  additionalMetadata?: Map<string, string>;
}
```

#### `getMetaplexMetadata(mintAddress): Promise<TokenMetadata | null>`

Gets only Metaplex metadata (does not fall back to Token-2022).

```typescript
const metaplexMetadata = await connection.getMetaplexMetadata(mintAddress);
if (metaplexMetadata) {
  console.log("This is a Metaplex NFT");
  console.log(`Royalties: ${metaplexMetadata.sellerFeeBasisPoints} basis points`);
}
```

#### `getToken2022Metadata(mintAddress): Promise<TokenMetadata | null>`

Gets only Token-2022 metadata (does not fall back to Metaplex).

```typescript
const token2022Metadata = await connection.getToken2022Metadata(mintAddress);
if (token2022Metadata) {
  console.log("This uses Token-2022 metadata extension");
}
```

#### `fetchMetadataJson(uri): Promise<NFTMetadataJson>`

Fetches and parses the JSON metadata from a token's URI.

```typescript
const jsonMetadata = await connection.fetchMetadataJson("https://arweave.net/...");
console.log(jsonMetadata.image);
console.log(jsonMetadata.attributes);
```

#### `getCompleteMetadata(mintAddress): Promise<{onChain, offChain} | null>`

Gets both on-chain and off-chain metadata in one call.

```typescript
const complete = await connection.getCompleteMetadata(mintAddress);
if (complete) {
  console.log(complete.onChain.name);
  console.log(complete.offChain.description);
}
```

#### `getBatchTokenMetadata(mintAddresses): Promise<Map<Address, TokenMetadata | null>>`

Gets token metadata for multiple mints in parallel.

```typescript
const metadataMap = await connection.getBatchTokenMetadata([mint1, mint2, mint3]);
```

#### `validateMetadataUri(uri): Promise<boolean>`

Validates that a URI is accessible and returns valid JSON.

```typescript
const isValid = await connection.validateMetadataUri("https://arweave.net/...");
```

#### `updateTokenMetadata(params): Promise<string>`

Updates token metadata, intelligently handling both Metaplex and Token-2022 sources.

**Token-2022**: Fully supported - updates name, symbol, uri, and additional metadata fields.

**Metaplex**: Fully supported using Codama-generated Metaplex Token Metadata connection. Updates name, symbol, and uri while preserving existing creators, collection, and seller fees. Note that Metaplex updates replace all metadata fields, so this method fetches existing metadata and merges your updates with it.

```typescript
import { loadWalletFromEnvironment } from "solana-kite";

const updateAuthority = await loadWalletFromEnvironment("UPDATE_AUTHORITY_SECRET_KEY");

// Works for Token-2022 tokens
const signature = await connection.updateTokenMetadata({
  mintAddress: token2022MintAddress,
  updateAuthority,
  name: "New Token Name",
  symbol: "NEW",
  uri: "https://arweave.net/new-metadata",
  additionalMetadata: {
    "description": "Updated description",
    "image": "https://arweave.net/new-image.png"
  }
});

// Also works for Metaplex NFTs
const nftSignature = await connection.updateTokenMetadata({
  mintAddress: metaplexNftMintAddress,
  updateAuthority,
  name: "New NFT Name",
  symbol: "NFT",
  uri: "https://arweave.net/new-nft-metadata"
});

// The plugin automatically detects which metadata system is used
// and calls the appropriate update function
```

## Metadata Sources

### Metaplex Token Metadata

The original NFT standard on Solana. Metadata is stored in a separate PDA account with:
- Creators array with verification status and revenue shares
- Collection verification
- Royalty information (seller fee basis points)
- Update authority
- Mutability flag

Most NFTs on Solana use this standard.

### Token-2022 Metadata Extension

Newer standard built into SPL Token-2022. Metadata is stored directly in the mint account:
- Simpler structure (name, symbol, URI)
- Additional metadata key-value pairs
- More gas-efficient
- Used by newer tokens created with Token-2022

## Examples

### Display NFT Gallery

```typescript
async function displayNFTGallery(walletAddress: Address) {
  const tokenAccounts = await connection.getTokenAccounts(walletAddress);

  // Filter for NFTs (amount = 1, decimals = 0)
  const nftAccounts = tokenAccounts.filter(
    (account) => account.amount === "1" && account.decimals === 0,
  );

  const mints = nftAccounts.map((account) => address(account.mint));
  const metadataMap = await connection.getBatchTokenMetadata(mints);

  for (const [mint, metadata] of metadataMap) {
    if (metadata) {
      const complete = await connection.getCompleteMetadata(mint);
      if (complete) {
        console.log(`\n${complete.onChain.name}`);
        console.log(`  Source: ${complete.onChain.source}`);
        console.log(`  Description: ${complete.offChain.description}`);
        console.log(`  Image: ${complete.offChain.image}`);

        if (complete.onChain.source === "metaplex" && complete.onChain.creators) {
          console.log("  Creators:");
          for (const creator of complete.onChain.creators) {
            console.log(`    ${creator.address}: ${creator.share}%`);
          }
        }
      }
    }
  }
}
```

### Check Collection Membership

```typescript
async function isInCollection(nftMint: Address, collectionMint: Address): Promise<boolean> {
  const metadata = await connection.getMetaplexMetadata(nftMint);

  if (!metadata || metadata.source !== "metaplex") {
    return false;
  }

  return metadata.collection?.key === collectionMint && metadata.collection.verified;
}
```

### Verify Creator

```typescript
async function hasVerifiedCreator(nftMint: Address, creatorAddress: Address): Promise<boolean> {
  const metadata = await connection.getMetaplexMetadata(nftMint);

  if (!metadata || metadata.source !== "metaplex" || !metadata.creators) {
    return false;
  }

  return metadata.creators.some(
    (creator) => creator.address === creatorAddress && creator.verified
  );
}
```

### Calculate Royalties

```typescript
async function calculateRoyalty(nftMint: Address, salePrice: number): Promise<number> {
  const metadata = await connection.getMetaplexMetadata(nftMint);

  if (!metadata || metadata.source !== "metaplex") {
    return 0;
  }

  // Seller fee basis points: 500 = 5%
  return (salePrice * (metadata.sellerFeeBasisPoints || 0)) / 10000;
}

const royalty = await calculateRoyalty(nftMint, 100); // $100 sale
console.log(`Royalty: $${royalty}`);
```

## Caching

The plugin includes intelligent caching:

- Metadata is cached for the configured duration (default: 1 hour)
- Cache can be bypassed with `useCache: false` parameter
- Cache can be cleared manually: `connection.metaplex.clearCache()`
- Individual cached entries can be checked: `connection.metaplex.getCachedMetadata(mint)`

Token metadata changes infrequently, so aggressive caching is appropriate.

## Configuration

### Prefer Token-2022

```typescript
// Check Token-2022 first, then fall back to Metaplex
const connection = createClient().use(kite({ clusterNameOrURL: "mainnet-beta" })).use(
  metaplex({ preferMetaplex: false })
);
```

### Custom Cache Time

```typescript
// Cache for 30 minutes
const connection = createClient().use(kite({ clusterNameOrURL: "mainnet-beta" })).use(
  metaplex({ cacheTime: 1800000 })
);
```

## Composing with Other Plugins

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { jupiter } from "kit-plugin-jupiter-pricing";
import { metaplex } from "kit-plugin-metaplex";

const connection = createClient().use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(jupiter({ jupiterApiKey: process.env.JUPITER_API_KEY }))
  .use(metaplex());

// Use both pricing and metadata features
const metadata = await connection.getTokenMetadata(mintAddress);
const price = await connection.getTokenPrice(mintAddress);

console.log(`${metadata.name}: ${connection.formatUsdValue(price)}`);
```

## Testing

```bash
npm test
```

## Requirements

- Node.js 18+
- Solana Kite 3.0+
- Solana Kit 5.0+

## Implementation Status

✅ **Metaplex Metadata Reading**: Full support for Metaplex Token Metadata V1
✅ **Metaplex Metadata Updating**: Full support using Codama-generated client
✅ **Token-2022 Reading**: Full support via Kite's existing functionality
✅ **Token-2022 Updating**: Full support for updating Token-2022 metadata fields
✅ **Intelligent Detection**: Automatically detects and uses correct metadata source
✅ **Off-Chain JSON**: Full support for fetching and parsing NFT metadata JSON
✅ **Batch Operations**: Parallel metadata fetching for multiple tokens
✅ **Caching**: Built-in caching system

## Limitations

- Metaplex metadata deserialization handles the most common V1 format. For edge cases with programmable NFTs or complex token standards, consider using the full Codama-generated client directly
- Metaplex metadata updates currently support updating name, symbol, and uri while preserving existing creators, collection, and seller fees. For advanced operations like adding/removing creators or changing collection verification, use the generated Codama client directly (available in `src/generated/mpl_token_metadata-client/`)
- Master Edition account reading is not included (can be added if needed)

## License

MIT

## Credits

Built for Solana Kit. Compatible with both Metaplex Token Metadata and SPL Token-2022 metadata standards.
