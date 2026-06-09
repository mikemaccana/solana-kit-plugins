import { extendClient } from "@solana/kit";
import type { Address, Instruction, KeyPairSigner } from "@solana/kit";
import type { Connection } from "solana-kite";
import { TukTukClient } from "./tuktuk-client.js";
import type {
  TukTukConfig,
  QueueTaskParams,
  CronJobParams,
  CompiledTransaction,
  AddressLookupTable,
} from "./types.js";

export interface TukTukMethods {
  tuktuk: TukTukClient;

  /**
   * Gets or creates a task queue by name.
   */
  getOrCreateTaskQueue: (user: KeyPairSigner, taskQueueName?: string) => Promise<Address>;

  /**
   * Queues a task for execution.
   */
  queueTask: (
    user: KeyPairSigner,
    taskQueue: Address,
    params: QueueTaskParams,
  ) => Promise<{ signature: string; taskId: number; taskAddress: Address }>;

  /**
   * Creates a cron job that runs on a schedule.
   */
  createCronJob: (user: KeyPairSigner, taskQueue: Address, params: CronJobParams) => Promise<Address>;

  /**
   * Adds a transaction to a cron job.
   */
  addCronTransaction: (
    user: KeyPairSigner,
    cronJob: Address,
    transactionId: number,
    compiledTransaction: CompiledTransaction,
  ) => Promise<string>;

  /**
   * Monitors a task until it completes or fails.
   */
  monitorTask: (taskAddress: Address, timeoutMs?: number) => Promise<boolean>;

  /**
   * Compiles instructions into a TukTuk transaction format.
   */
  compileTukTukTransaction: (
    instructions: Array<Instruction>,
    addressLookupTables?: Array<AddressLookupTable>,
  ) => CompiledTransaction;

  /**
   * Gets the address for a cron job by name.
   */
  getCronJobForName: (user: KeyPairSigner, cronName: string) => Promise<Address | null>;

  /**
   * Funds a task queue with additional SOL.
   */
  fundTaskQueue: (user: KeyPairSigner, taskQueue: Address, amount: bigint) => Promise<string>;
}

export type ConnectionWithTukTuk = Connection & TukTukMethods;

/**
 * Creates a TukTuk task scheduler plugin for Solana Kit.
 *
 * This plugin enables scheduling transactions to run at specific times or on recurring schedules.
 *
 * @param config - Configuration options
 * @param config.defaultTaskQueueName - Default task queue name to use (default: "default-queue")
 * @param config.cluster - Cluster to use for TukTuk operations (default: inherits from connection)
 * @returns A plugin function that extends connections with TukTuk functionality
 *
 * @example
 * ```typescript
 * import { createClient } from "@solana/kit";
 * import { kite } from "kit-plugin-kite";
 * import { tuktuk } from "kit-plugin-tuktuk-task-scheduler";
 * import { getAddMemoInstruction } from "@solana-program/memo";
 *
 * const client = createClient()
 *   .use(kite({ clusterNameOrURL: "devnet" }))
 *   .use(tuktuk());
 *
 * // Get or create a task queue
 * const taskQueue = await client.getOrCreateTaskQueue(wallet, "my-queue");
 *
 * // Queue a one-time task
 * const memoInstruction = getAddMemoInstruction({ memo: "Hello TukTuk!" });
 * const compiledTransaction = client.compileTukTukTransaction([memoInstruction]);
 *
 * const { taskId, taskAddress } = await client.queueTask(wallet, taskQueue, {
 *   trigger: { __kind: "Now" },
 *   transaction: compiledTransaction,
 *   description: "My memo task",
 * });
 *
 * // Create a cron job that runs every minute
 * const cronJob = await client.createCronJob(wallet, taskQueue, {
 *   name: "my-cron",
 *   schedule: "0 * * * * *",
 *   freeTasksPerTransaction: 0,
 *   numTasksPerQueueCall: 1,
 * });
 * ```
 */
export const tuktuk = (config: TukTukConfig = {}) => {
  return <T extends Connection>(connection: T) => {
    const tukTukClient = new TukTukClient(connection, config.defaultTaskQueueName);

    const getOrCreateTaskQueue = async (
      user: KeyPairSigner,
      taskQueueName?: string,
    ): Promise<Address> => {
      return tukTukClient.getOrCreateTaskQueue(user, taskQueueName);
    };

    const queueTask = async (
      user: KeyPairSigner,
      taskQueue: Address,
      params: QueueTaskParams,
    ): Promise<{ signature: string; taskId: number; taskAddress: Address }> => {
      return tukTukClient.queueTask(user, taskQueue, params);
    };

    const createCronJob = async (
      user: KeyPairSigner,
      taskQueue: Address,
      params: CronJobParams,
    ): Promise<Address> => {
      return tukTukClient.createCronJob(user, taskQueue, params);
    };

    const addCronTransaction = async (
      user: KeyPairSigner,
      cronJob: Address,
      transactionId: number,
      compiledTransaction: CompiledTransaction,
    ): Promise<string> => {
      return tukTukClient.addCronTransaction(user, cronJob, transactionId, compiledTransaction);
    };

    const monitorTask = async (taskAddress: Address, timeoutMs?: number): Promise<boolean> => {
      return tukTukClient.monitorTask(taskAddress, timeoutMs);
    };

    const compileTukTukTransaction = (
      instructions: Array<Instruction>,
      addressLookupTables: Array<AddressLookupTable> = [],
    ): CompiledTransaction => {
      return tukTukClient.compileTukTukTransaction(instructions, addressLookupTables);
    };

    const getCronJobForName = async (user: KeyPairSigner, cronName: string): Promise<Address | null> => {
      return tukTukClient.getCronJobForName(user, cronName);
    };

    const fundTaskQueue = async (
      user: KeyPairSigner,
      taskQueue: Address,
      amount: bigint,
    ): Promise<string> => {
      return tukTukClient.fundTaskQueue(user, taskQueue, amount);
    };

    return extendClient(connection, {
      tuktuk: tukTukClient,
      getOrCreateTaskQueue,
      queueTask,
      createCronJob,
      addCronTransaction,
      monitorTask,
      compileTukTukTransaction,
      getCronJobForName,
      fundTaskQueue,
    });
  };
};

