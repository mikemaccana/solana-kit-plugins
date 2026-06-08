# Solana Kite Squads Multisig

A production-ready Kite plugin for Squads Protocol v4 multisig operations, built with Codama-generated clients and zero web3.js dependencies.

## Features

✅ **Zero web3.js dependency** - Pure Solana Kit implementation
✅ **Type-safe** - Full TypeScript support via Codama-generated client
✅ **Modern tooling** - Codama types instead of legacy Beet
✅ **Kite consistency** - Same patterns as other Kite operations
✅ **Plugin composability** - Works seamlessly with other Kite plugins
✅ **Squads v4** - Supports latest Squads Protocol with roles, permissions, and spending limits

## Why This Plugin?

The official `@sqds/multisig` uses web3.js v1. This plugin provides a modern alternative:

- **No web3.js legacy code** - Built on Solana Kit from the ground up
- **Better performance** - No unnecessary dependencies
- **Consistent API** - Follows Kite plugin patterns
- **Future-proof** - Uses current Solana tooling standards

## Installation

```bash
npm install kit-plugin-squads-multisig solana-kite @solana/kit
```

## Quick Start

### Create a Multisig

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { squadsMultisig } from "kit-plugin-squads-multisig";
import { loadWalletFromEnvironment } from "solana-kite";

const connection = createClient().use(kite({ clusterNameOrURL: "devnet" })).use(squadsMultisig());
const creator = await loadWalletFromEnvironment("CREATOR_SECRET_KEY");

// Create a 2-of-3 multisig
const { multisig, signature } = await connection.createMultisig({
  creator,
  config: {
    threshold: 2,
    members: [member1.address, member2.address, member3.address],
    timeLock: 0, // No time lock
  }
});

console.log(`Multisig created: ${multisig}`);
```

### Create and Execute a Proposal

```typescript
import { getTransferSolInstruction } from "@solana-program/system";

// Get vault address (where multisig funds are stored)
const vault = await connection.getVaultAddress(multisig);

// Create a transfer instruction
const transferInstruction = getTransferSolInstruction({
  source: vault,
  destination: recipient,
  amount: 1000000n, // 0.001 SOL
});

// Create proposal
const { proposal, transactionIndex } = await connection.createProposal({
  multisig,
  creator: member1,
  instructions: [transferInstruction],
});

// Approve with member 2 (reaches threshold of 2)
await connection.approveProposal({
  multisig,
  transactionIndex,
  member: member2,
});

// Execute the approved proposal
await connection.executeProposal({
  multisig,
  transactionIndex,
  member: member1,
});
```

## API Reference

### Configuration

```typescript
interface SquadsConfig {
  cluster?: string; // Default: inherits from connection
}
```

### Multisig Configuration

```typescript
interface MultisigConfig {
  threshold: number; // Number of approvals required
  members: Array<Address>; // Member addresses
  timeLock?: number; // Time lock in seconds (default: 0)
  rentCollector?: Address; // Optional rent collector
}
```

### Methods

#### `createMultisig(params): Promise<{ multisig: Address; signature: string }>`

Creates a new multisig wallet.

```typescript
const { multisig } = await connection.createMultisig({
  creator: wallet,
  config: {
    threshold: 2,
    members: [member1.address, member2.address, member3.address]
  }
});
```

#### `createProposal(params): Promise<{ proposal: Address; transactionIndex: bigint; signature: string }>`

Creates a new transaction proposal for the multisig.

```typescript
const { proposal, transactionIndex } = await connection.createProposal({
  multisig,
  creator: member,
  instructions: [instruction1, instruction2]
});
```

#### `approveProposal(params): Promise<string>`

Approves a proposal as a multisig member.

```typescript
await connection.approveProposal({
  multisig,
  transactionIndex,
  member: signingMember
});
```

#### `rejectProposal(params): Promise<string>`

Rejects a proposal as a multisig member.

```typescript
await connection.rejectProposal({
  multisig,
  transactionIndex,
  member: signingMember
});
```

#### `executeProposal(params): Promise<string>`

Executes an approved proposal (must meet threshold).

```typescript
await connection.executeProposal({
  multisig,
  transactionIndex,
  member: anyMember
});
```

#### `getMultisigAccount(multisig): Promise<MultisigAccount>`

Gets multisig account data.

```typescript
const multisigData = await connection.getMultisigAccount(multisig);
console.log(`Threshold: ${multisigData.threshold}`);
console.log(`Members: ${multisigData.members.length}`);
```

#### `getProposalAccount(proposal): Promise<ProposalAccount>`

Gets proposal account data.

```typescript
const proposalData = await connection.getProposalAccount(proposal);
console.log(`Status: ${proposalData.status}`);
console.log(`Approvals: ${proposalData.approvalCount}`);
```

#### `getVaultAddress(multisig, vaultIndex?): Promise<Address>`

Derives the vault PDA address where multisig funds are stored.

```typescript
const vault = await connection.getVaultAddress(multisig, 0); // Index 0 is default
```

## Examples

### Treasury Management

```typescript
// Create treasury multisig
const { multisig } = await connection.createMultisig({
  creator: dao,
  config: {
    threshold: 3,
    members: [councilMember1, councilMember2, councilMember3, councilMember4, councilMember5],
    timeLock: 86400, // 24 hour time lock
  }
});

// Get treasury vault address
const treasury = await connection.getVaultAddress(multisig);

// Fund the treasury
await connection.transferLamports({
  source: funder,
  destination: treasury,
  amount: 100_000_000_000n, // 100 SOL
});
```

### Token Transfers from Multisig

```typescript
import { getMintToInstruction } from "@solana-program/token-2022";

// Create proposal to mint tokens from multisig-controlled mint
const { transactionIndex } = await connection.createProposal({
  multisig,
  creator: member1,
  instructions: [
    getMintToInstruction({
      mint: tokenMint,
      token: recipientTokenAccount,
      mintAuthority: await connection.getVaultAddress(multisig),
      amount: 1000000n,
    })
  ],
});

// Collect approvals
await connection.approveProposal({ multisig, transactionIndex, member: member1 });
await connection.approveProposal({ multisig, transactionIndex, member: member2 });
await connection.approveProposal({ multisig, transactionIndex, member: member3 });

// Execute when threshold is met
await connection.executeProposal({ multisig, transactionIndex, member: member1 });
```

### Composing with Other Plugins

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { squadsMultisig } from "kit-plugin-squads-multisig";
import { metaplex } from "kit-plugin-metaplex";

const connection = createClient().use(kite({ clusterNameOrURL: "mainnet-beta" }))
  .use(squadsMultisig())
  .use(metaplex());

// Use multisig to update NFT metadata
const vault = await connection.getVaultAddress(multisig);

const { transactionIndex } = await connection.createProposal({
  multisig,
  creator: member1,
  instructions: [
    // Instruction to update metadata with vault as authority
    // (would need proper instruction building)
  ],
});
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

✅ **Multisig Creation** - Create multisig wallets with custom threshold and members
✅ **Proposal Lifecycle** - Create, approve, reject, and execute proposals
✅ **Vault Management** - Derive vault addresses for fund storage
✅ **PDA Derivation** - Correct seed derivation for all PDAs (multisig, proposal, transaction, vault)
✅ **Type Safety** - Full TypeScript types via Codama-generated client
✅ **Account Deserialization** - Proper parsing of multisig and proposal account data
✅ **Program Config** - Fetches programConfig and treasury for multisig creation

## Advanced Features

For advanced operations like spending limits, batch operations, and config changes, use the generated Codama client directly (available in `src/generated/squads_multisig_program-client/`). The client provides all Squads v4 instructions with full type safety.

## License

MIT

## Credits

Built for Solana Kite. Uses Squads Protocol v4 IDL via Codama for type-safe multisig operations.
