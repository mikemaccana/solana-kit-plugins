# Solana Kite TukTuk Task Scheduler

TukTuk task scheduler plugin for Solana Kit enabling scheduled and recurring transactions.

This plugin extends Solana Kite with TukTuk integration, allowing you to schedule transactions to run at specific times or on recurring schedules.

## Features

- **One-Time Tasks**: Schedule transactions to run immediately or at a specific timestamp
- **Recurring Tasks (Cron Jobs)**: Schedule transactions to run on a regular schedule
- **Task Monitoring**: Track task execution status
- **Task Management**: List, close, and fund task queues
- **Type-Safe**: Full TypeScript support
- **Zero web3.js**: Built entirely on Solana Kit with no legacy dependencies

## Installation

```bash
npm install kit-plugin-tuktuk-task-scheduler solana-kite @solana/kit
```

## Important Notes

**Task Queues**: Task queues are shared pools where tasks wait to be executed. Creating a task queue costs 1 SOL (refundable), so you should reuse queues when possible rather than creating one per user.

**Crank Turners**: Tasks are executed by network participants running "crank turners" who earn SOL rewards. Your task reward must exceed transaction costs or it won't be executed.

## Quick Start

### One-Time Task

```typescript
import { createClient } from "@solana/kit";
import { kite } from "kit-plugin-kite";
import { tuktuk } from "kit-plugin-tuktuk-task-scheduler";
import { getAddMemoInstruction } from "@solana-program/memo";

const connection = createClient().use(kite({ clusterNameOrURL: "devnet" })).use(tuktuk());
const wallet = await connection.loadWalletFromEnvironment("WALLET_SECRET_KEY");

// Get or create a task queue
const taskQueue = await connection.getOrCreateTaskQueue(wallet, "my-queue");

// Create a memo instruction
const memoInstruction = getAddMemoInstruction({ memo: "Hello TukTuk!" });
const compiledTransaction = connection.compileTukTukTransaction([memoInstruction]);

// Queue the task to run immediately
const { taskId, taskAddress, signature } = await connection.queueTask(wallet, taskQueue, {
  trigger: { __kind: "Now" },
  transaction: compiledTransaction,
  description: "My memo task",
});

console.log(`Task queued with ID: ${taskId}`);

// Monitor task execution
const completed = await connection.monitorTask(taskAddress, 60000);
console.log(completed ? "Task completed!" : "Task timed out");
```

### Recurring Task (Cron Job)

```typescript
import { getTransferSolInstruction } from "@solana-program/system";

// Get or create task queue
const taskQueue = await connection.getOrCreateTaskQueue(wallet, "my-queue");

// Create a cron job that runs every minute
const cronJob = await connection.createCronJob(wallet, taskQueue, {
  name: "my-cron-job",
  schedule: "0 * * * * *", // Standard cron syntax: every minute
  freeTasksPerTransaction: 0,
  numTasksPerQueueCall: 1,
});

// Fund the cron job (needed to pay for ongoing tasks)
const fundingAmount = BigInt(10_000_000); // 0.01 SOL
await connection.fundTaskQueue(wallet, cronJob, fundingAmount);

// Create the transaction to run on schedule
const memoInstruction = getAddMemoInstruction({ memo: "Recurring memo!" });
const compiledTransaction = connection.compileTukTukTransaction([memoInstruction]);

// Add the transaction to the cron job
await connection.addCronTransaction(wallet, cronJob, 0, compiledTransaction);

console.log(`Cron job created at: ${cronJob}`);
```

### Scheduled Task (Run at Specific Time)

```typescript
// Schedule a task to run at a specific timestamp
const futureTimestamp = BigInt(Date.now() + 60000); // 1 minute from now

const { taskId } = await connection.queueTask(wallet, taskQueue, {
  trigger: {
    __kind: "Timestamp",
    timestamp: futureTimestamp
  },
  transaction: compiledTransaction,
  description: "Scheduled memo task",
});

console.log(`Task scheduled for: ${new Date(Number(futureTimestamp))}`);
```

## API Reference

### Configuration

```typescript
interface TukTukConfig {
  defaultTaskQueueName?: string; // Default: "default-queue"
  cluster?: string;              // Default: inherits from connection
}
```

### Methods

#### `getOrCreateTaskQueue(user, taskQueueName?): Promise<Address>`

Gets or creates a task queue by name. Task queues cost 1 SOL to create (refundable).

```typescript
const taskQueue = await connection.getOrCreateTaskQueue(wallet, "my-queue");
```

#### `queueTask(user, taskQueue, params): Promise<{signature, taskId, taskAddress}>`

Queues a task for execution.

```typescript
const { taskId, taskAddress } = await connection.queueTask(wallet, taskQueue, {
  trigger: { __kind: "Now" },
  transaction: compiledTransaction,
  crankReward: BigInt(1_000_000), // Optional: override queue default
  description: "My task",
});
```

#### `createCronJob(user, taskQueue, params): Promise<Address>`

Creates a cron job that runs on a schedule.

```typescript
const cronJob = await connection.createCronJob(wallet, taskQueue, {
  name: "my-cron",
  schedule: "0 * * * * *", // Every minute
  freeTasksPerTransaction: 0,
  numTasksPerQueueCall: 1,
});
```

**Cron Schedule Syntax**: Standard cron format with seconds:
- `0 * * * * *` - Every minute
- `0 0 * * * *` - Every hour
- `0 0 0 * * *` - Every day at midnight
- `0 0 12 * * *` - Every day at noon

#### `addCronTransaction(user, cronJob, transactionId, compiledTransaction): Promise<string>`

Adds a transaction to a cron job.

```typescript
await connection.addCronTransaction(wallet, cronJob, 0, compiledTransaction);
```

#### `monitorTask(taskAddress, timeoutMs?): Promise<boolean>`

Monitors a task until it completes or times out. Returns `true` if completed, `false` if timed out.

```typescript
const completed = await connection.monitorTask(taskAddress, 60000);
```

#### `compileTukTukTransaction(instructions, addressLookupTables?): CompiledTransaction`

Compiles instructions into TukTuk transaction format.

```typescript
const compiledTx = connection.compileTukTukTransaction([instruction1, instruction2]);
```

#### `fundTaskQueue(user, taskQueue, amount): Promise<string>`

Funds a task queue with additional SOL. Needed for queues that create recursive tasks (like cron jobs).

```typescript
await connection.fundTaskQueue(wallet, taskQueue, BigInt(50_000_000));
```

#### `getCronJobForName(user, cronName): Promise<Address | null>`

Gets the address of a cron job by name.

```typescript
const cronJob = await connection.getCronJobForName(wallet, "my-cron");
```

## Examples

### Token Transfer on Schedule

```typescript
import { getTransferTokensInstruction } from "@solana-program/token";

// Schedule a token transfer for tomorrow
const tomorrow = BigInt(Date.now() + 86400000);

const transferInstruction = getTransferTokensInstruction({
  source: sourceTokenAccount,
  destination: destinationTokenAccount,
  owner: wallet,
  amount: BigInt(1_000_000),
});

const compiledTx = connection.compileTukTukTransaction([transferInstruction]);

await connection.queueTask(wallet, taskQueue, {
  trigger: { __kind: "Timestamp", timestamp: tomorrow },
  transaction: compiledTx,
  description: "Tomorrow's token transfer",
});
```

### Automated Portfolio Rebalancing

```typescript
// Create a cron job that runs daily
const cronJob = await connection.createCronJob(wallet, taskQueue, {
  name: "daily-rebalance",
  schedule: "0 0 0 * * *", // Midnight every day
  freeTasksPerTransaction: 0,
  numTasksPerQueueCall: 1,
});

// Fund the cron job for a month of daily executions
await connection.fundTaskQueue(wallet, cronJob, BigInt(100_000_000));

// Add rebalancing transaction
const rebalanceInstructions = [/* your rebalancing logic */];
const compiledTx = connection.compileTukTukTransaction(rebalanceInstructions);
await connection.addCronTransaction(wallet, cronJob, 0, compiledTx);
```

### Claim Rewards Every Hour

```typescript
const cronJob = await connection.createCronJob(wallet, taskQueue, {
  name: "hourly-claim",
  schedule: "0 0 * * * *", // Every hour
  freeTasksPerTransaction: 0,
  numTasksPerQueueCall: 1,
});

// Your program's claim rewards instruction
const claimInstruction = getClaimRewardsInstruction({
  user: wallet,
  // ... other parameters
});

const compiledTx = connection.compileTukTukTransaction([claimInstruction]);
await connection.addCronTransaction(wallet, cronJob, 0, compiledTx);
```

## Task Queue Best Practices

1. **Reuse Task Queues**: Creating a task queue costs 1 SOL. Share queues across users and use cases.
2. **Set Appropriate Rewards**: Crank rewards must exceed transaction costs or tasks won't execute.
3. **Fund Cron Jobs**: Keep cron job accounts funded to ensure ongoing execution.
4. **Use Descriptions**: Add descriptive prefixes to task descriptions for easier management.
5. **Monitor Failed Tasks**: List and close tasks that fail to avoid filling up your queue.

## Remote Transactions

For complex transactions that need dynamic construction (like those requiring Merkle proofs), TukTuk supports remote transaction generation:

```typescript
await connection.queueTask(wallet, taskQueue, {
  trigger: { __kind: "Now" },
  transaction: {
    url: "https://my-server.com/generate-transaction",
  },
  description: "Remote transaction task",
});
```

Your server will receive a POST request with task details and must return a signed transaction.

## Testing

```bash
npm test
```

## Requirements

- Node.js 18+
- Solana Kite 3.0+
- Solana Kit 2.0+

## Implementation Status

🚧 **Current Status**: Plugin structure and API complete. Core implementation requires tuktuk-sdk integration.

The plugin provides the complete API surface for TukTuk functionality. To use it in production, the `TukTukClient` class needs implementation using the tuktuk-sdk TypeScript connection.

## License

MIT

## Credits

Built for Solana Kit. Based on [TukTuk](https://github.com/helium/tuktuk) by the Helium Foundation.
