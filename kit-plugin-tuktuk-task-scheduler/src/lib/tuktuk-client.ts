import type { Address, Instruction, KeyPairSigner } from "@solana/kit";
import type { Connection } from "solana-kite";
import type {
  TaskTrigger,
  CompiledTransaction,
  TaskQueueParams,
  QueueTaskParams,
  CronJobParams,
} from "./types.js";
import {
  getAddQueueAuthorityV0Instruction,
  fetchMaybeTaskQueueAuthorityV0,
  TUKTUK_PROGRAM_ADDRESS,
  TASK_QUEUE_NAME_MAPPING_V0_DISCRIMINATOR,
  getTaskQueueNameMappingV0Decoder,
  getQueueTaskV0InstructionAsync,
  getInitializeTaskQueueV0Instruction,
  fetchMaybeTuktukConfigV0,
  fetchTaskQueueV0,
} from "../generated/tuktuk-client/index.js";
import {
  CRON_PROGRAM_ADDRESS,
  fetchMaybeCronJobNameMappingV0,
  getInitializeCronJobV0InstructionAsync,
  fetchMaybeUserCronJobsV0,
  getAddCronTransactionV0Instruction,
} from "../generated/cron-client/index.js";

export class TukTukClient {
  private connection: Connection;
  private defaultTaskQueueName: string;

  constructor(connection: Connection, defaultTaskQueueName: string = "default-queue") {
    this.connection = connection;
    this.defaultTaskQueueName = defaultTaskQueueName;
  }

  /**
   * Converts a BigInt to a little-endian byte array of specified length.
   * Used for encoding numeric seeds for PDA derivation.
   */
  private bigIntToSeed(bigIntValue: bigint, byteLength: number): Uint8Array {
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength && bigIntValue > 0n; i++) {
      bytes[i] = Number(bigIntValue & 0xffn);
      bigIntValue >>= 8n;
    }
    return bytes;
  }

  /**
   * Hashes a task queue name using SHA-256.
   */
  private async hashTaskQueueName(name: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(name);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Hashes a cron job name using SHA-256.
   */
  private async hashCronName(cronName: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(cronName);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Finds the next available task ID from a bitmap.
   */
  private nextAvailableTaskId(taskBitmap: Uint8Array): number | null {
    for (let byteIdx = 0; byteIdx < taskBitmap.length; byteIdx++) {
      const byte = taskBitmap[byteIdx];
      if (byte !== 0xff) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          if ((byte & (1 << bitIdx)) === 0) {
            return byteIdx * 8 + bitIdx;
          }
        }
      }
    }
    return null;
  }

  /**
   * Parses TaskQueueV0 account data to extract task bitmap.
   */
  private parseTaskQueueV0(accountData: Uint8Array) {
    const TASK_QUEUE_V0_OFFSETS = {
      CAPACITY: 124,
      TASK_BITMAP_LEN: 143,
      TASK_BITMAP: 147,
    };

    const capacity = new DataView(accountData.buffer, accountData.byteOffset).getUint16(
      TASK_QUEUE_V0_OFFSETS.CAPACITY,
      true,
    );
    const bitmapLen = new DataView(accountData.buffer, accountData.byteOffset).getUint32(
      TASK_QUEUE_V0_OFFSETS.TASK_BITMAP_LEN,
      true,
    );
    const taskBitmap = accountData.slice(
      TASK_QUEUE_V0_OFFSETS.TASK_BITMAP,
      TASK_QUEUE_V0_OFFSETS.TASK_BITMAP + bitmapLen,
    );

    return { capacity, taskBitmap };
  }

  /**
   * Gets or creates a task queue by name.
   * Task queues are shared pools where tasks wait to be executed.
   */
  async getOrCreateTaskQueue(
    user: KeyPairSigner,
    taskQueueName: string = this.defaultTaskQueueName,
  ): Promise<Address> {
    const tuktukConfigPda = await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, ["tuktuk_config"]);
    const tuktukConfig = tuktukConfigPda.pda;

    const taskQueueNameHash = await this.hashTaskQueueName(taskQueueName);
    const taskQueueNameMappingPda = await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, [
      "task_queue_name_mapping",
      tuktukConfig,
      taskQueueNameHash,
    ]);

    const getTaskQueueNameMappings = this.connection.getAccountsFactory(
      TUKTUK_PROGRAM_ADDRESS,
      // Codama emits discriminators as ReadonlyUint8Array; getAccountsFactory wants a mutable Uint8Array.
      new Uint8Array(TASK_QUEUE_NAME_MAPPING_V0_DISCRIMINATOR),
      getTaskQueueNameMappingV0Decoder(),
    );

    const nameMappings = await getTaskQueueNameMappings();

    const queueNameMapping =
      nameMappings.find((nameMapping) => nameMapping.exists && nameMapping.data.name === taskQueueName) || null;

    let taskQueue: Address;
    if (queueNameMapping?.exists) {
      taskQueue = queueNameMapping.data.taskQueue;
    } else {
      console.log("Task queue not found, creating...");

      const tuktukConfigAccount = await fetchMaybeTuktukConfigV0(this.connection.rpc, tuktukConfig);
      if (!tuktukConfigAccount.exists) {
        throw new Error("TukTuk config not found. The program may not be initialized.");
      }
      const nextTaskQueueId = tuktukConfigAccount.data.nextTaskQueueId;

      const taskQueueIdBuffer = this.bigIntToSeed(BigInt(nextTaskQueueId), 4);
      const taskQueuePda = await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, [
        "task_queue",
        tuktukConfig,
        taskQueueIdBuffer,
      ]);
      taskQueue = taskQueuePda.pda;

      const HOURS_IN_SECONDS = 60 * 60;
      const MIN_CRANK_REWARD = 10000n;
      const CAPACITY = 10;
      const STALE_TASK_AGE_SECONDS = 48 * HOURS_IN_SECONDS;

      const createTaskQueueInstruction = getInitializeTaskQueueV0Instruction({
        payer: user as any,
        tuktukConfig,
        updateAuthority: user.address,
        taskQueue,
        taskQueueNameMapping: taskQueueNameMappingPda.pda,
        minCrankReward: MIN_CRANK_REWARD,
        name: taskQueueName,
        capacity: CAPACITY,
        lookupTables: [],
        staleTaskAge: STALE_TASK_AGE_SECONDS,
      });

      await this.connection.sendTransactionFromInstructions({
        feePayer: user as any,
        instructions: [createTaskQueueInstruction],
      });

      console.log("✅ Task queue created:", taskQueue);
    }

    const taskQueueAuthority = (
      await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, ["task_queue_authority", taskQueue, user.address])
    ).pda;

    const queueAuthorityAccount = await fetchMaybeTaskQueueAuthorityV0(this.connection.rpc, taskQueueAuthority);

    if (!queueAuthorityAccount.exists) {
      console.log("Adding queue authority...");

      const addAuthorityInstruction = getAddQueueAuthorityV0Instruction({
        payer: user as any,
        updateAuthority: user as any,
        queueAuthority: user.address,
        taskQueueAuthority,
        taskQueue,
      });

      await this.connection.sendTransactionFromInstructions({
        feePayer: user as any,
        instructions: [addAuthorityInstruction],
      });
      console.log("✅ Queue authority added");
    }

    console.log("✅ Task queue ready:", taskQueue);
    return taskQueue;
  }

  /**
   * Queues a task for execution.
   * Tasks can run immediately or at a specific timestamp.
   */
  async queueTask(
    user: KeyPairSigner,
    taskQueue: Address,
    params: QueueTaskParams,
  ): Promise<{ signature: string; taskId: number; taskAddress: Address }> {
    const taskQueueAccount = await this.connection.rpc
      .getAccountInfo(taskQueue, {
        encoding: "base64",
      })
      .send();
    if (!taskQueueAccount.value) {
      throw new Error("Task queue account not found");
    }

    let accountData: Uint8Array;
    if (Array.isArray(taskQueueAccount.value.data) && taskQueueAccount.value.data.length === 2) {
      accountData = new Uint8Array(Buffer.from(taskQueueAccount.value.data[0] as string, "base64"));
    } else if (typeof taskQueueAccount.value.data === "string") {
      accountData = new Uint8Array(Buffer.from(taskQueueAccount.value.data, "base64"));
    } else {
      accountData = new Uint8Array(taskQueueAccount.value.data as any);
    }

    const { taskBitmap } = this.parseTaskQueueV0(accountData);
    const taskId = this.nextAvailableTaskId(taskBitmap);
    if (taskId === null) {
      throw new Error("No available task slots in queue");
    }

    const taskIdBuffer = this.bigIntToSeed(BigInt(taskId), 2);
    const taskPda = await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, ["task", taskQueue, taskIdBuffer]);
    const taskAddress = taskPda.pda;

    const instruction = await getQueueTaskV0InstructionAsync({
      payer: user as any,
      queueAuthority: user as any,
      taskQueue,
      task: taskAddress,
      id: taskId,
      trigger: params.trigger as any,
      transaction: params.transaction as any,
      crankReward: params.crankReward || null,
      freeTasks: params.freeTasks || 0,
      description: params.description || "",
    });

    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: user as any,
      instructions: [instruction],
    });

    return {
      signature,
      taskId,
      taskAddress,
    };
  }

  /**
   * Creates a cron job that runs on a schedule.
   * The schedule uses standard cron syntax (e.g., "0 * * * * *" for every minute).
   */
  async createCronJob(
    user: KeyPairSigner,
    taskQueue: Address,
    params: CronJobParams,
  ): Promise<Address> {
    console.log("Creating cron job:", params.name);

    const userCronJobsPda = await this.connection.getPDAAndBump(CRON_PROGRAM_ADDRESS, [
      "user_cron_jobs",
      user.address,
    ]);

    const userCronJobs = await fetchMaybeUserCronJobsV0(this.connection.rpc, userCronJobsPda.pda);
    const nextCronJobId = userCronJobs.exists ? userCronJobs.data.nextCronJobId : 0;

    const cronJobIdBuffer = this.bigIntToSeed(BigInt(nextCronJobId), 4);
    const cronJobPda = await this.connection.getPDAAndBump(CRON_PROGRAM_ADDRESS, [
      "cron_job",
      user.address,
      cronJobIdBuffer,
    ]);
    const cronJob = cronJobPda.pda;

    const cronJobNameHash = await this.hashCronName(params.name);
    const cronJobNameMappingPda = await this.connection.getPDAAndBump(CRON_PROGRAM_ADDRESS, [
      "cron_job_name_mapping",
      user.address,
      cronJobNameHash,
    ]);

    const taskQueueAccount = await fetchTaskQueueV0(this.connection.rpc, taskQueue);
    const taskBitmap = new Uint8Array(taskQueueAccount.data.taskBitmap);
    const nextTaskId = this.nextAvailableTaskId(taskBitmap);
    if (nextTaskId === null) {
      throw new Error("No available task slots in queue");
    }

    const taskIdBuffer = this.bigIntToSeed(BigInt(nextTaskId), 2);
    const taskPda = await this.connection.getPDAAndBump(TUKTUK_PROGRAM_ADDRESS, ["task", taskQueue, taskIdBuffer]);
    const task = taskPda.pda;

    const initInstruction = await getInitializeCronJobV0InstructionAsync({
      payer: user as any,
      queueAuthority: user as any,
      authority: user as any,
      cronJob,
      cronJobNameMapping: cronJobNameMappingPda.pda,
      taskQueue,
      task,
      schedule: params.schedule,
      name: params.name,
      freeTasksPerTransaction: params.freeTasksPerTransaction,
      numTasksPerQueueCall: params.numTasksPerQueueCall,
    });

    await this.connection.sendTransactionFromInstructions({
      feePayer: user as any,
      instructions: [initInstruction],
    });

    console.log("✅ Cron job created:", cronJob);
    return cronJob;
  }

  /**
   * Adds a transaction to a cron job.
   * This transaction will be queued according to the cron schedule.
   */
  async addCronTransaction(
    user: KeyPairSigner,
    cronJob: Address,
    transactionId: number,
    compiledTransaction: CompiledTransaction,
  ): Promise<string> {
    console.log(`Adding transaction ${transactionId} to cron job...`);

    const cronJobTransactionIdBuffer = this.bigIntToSeed(BigInt(transactionId), 4);
    const cronJobTransactionPda = await this.connection.getPDAAndBump(CRON_PROGRAM_ADDRESS, [
      "cron_job_transaction",
      cronJob,
      cronJobTransactionIdBuffer,
    ]);

    const addTransactionInstruction = getAddCronTransactionV0Instruction({
      payer: user as any,
      authority: user as any,
      cronJob,
      cronJobTransaction: cronJobTransactionPda.pda,
      index: transactionId,
      transactionSource: {
        __kind: "CompiledV0" as const,
        fields: [compiledTransaction as any],
      },
    });

    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: user as any,
      instructions: [addTransactionInstruction],
    });

    console.log("✅ Transaction added to cron job");
    return signature;
  }

  /**
   * Monitors a task until it completes or fails.
   */
  async monitorTask(taskAddress: Address, timeoutMs: number = 60000): Promise<boolean> {
    const TASK_POLL_INTERVAL_MS = 2000;
    const startTime = Date.now();

    return new Promise<boolean>((resolve) => {
      const interval = setInterval(async () => {
        try {
          if (Date.now() - startTime > timeoutMs) {
            console.log("Task monitoring timed out");
            clearInterval(interval);
            resolve(false);
            return;
          }

          const taskAccount = await this.connection.rpc.getAccountInfo(taskAddress).send();
          if (!taskAccount.value) {
            console.log("Task completed! ✅");
            clearInterval(interval);
            resolve(true);
            return;
          }
          console.log("Task is still pending...");
        } catch (error) {
          console.log("Task completed! ✅");
          clearInterval(interval);
          resolve(true);
        }
      }, TASK_POLL_INTERVAL_MS);
    });
  }

  /**
   * Compiles instructions into a TukTuk transaction format.
   */
  compileTukTukTransaction(
    instructions: Array<Instruction>,
    addressLookupTables: Array<any> = [],
  ): CompiledTransaction {
    const accountSet = new Set<string>();
    const accountMetas: Array<{ address: string; isSigner: boolean; isWritable: boolean }> = [];

    for (const instruction of instructions) {
      if (instruction.accounts) {
        for (const account of instruction.accounts) {
          if (!accountSet.has(account.address)) {
            accountSet.add(account.address);
            accountMetas.push({
              address: account.address,
              isSigner:
                (account.role as any) === "ReadonlySigner" || (account.role as any) === "WritableSigner",
              isWritable: (account.role as any) === "Writable" || (account.role as any) === "WritableSigner",
            });
          }
        }
      }
      if (!accountSet.has(instruction.programAddress)) {
        accountSet.add(instruction.programAddress);
        accountMetas.push({
          address: instruction.programAddress,
          isSigner: false,
          isWritable: false,
        });
      }
    }

    accountMetas.sort((a, b) => {
      if (a.isSigner !== b.isSigner) return b.isSigner ? 1 : -1;
      if (a.isWritable !== b.isWritable) return b.isWritable ? 1 : -1;
      return 0;
    });

    const accounts = accountMetas.map((meta) => meta.address as Address);
    const accountMap = new Map(accounts.map((address, index) => [address, index]));

    const numRwSigners = accountMetas.filter((m) => m.isSigner && m.isWritable).length;
    const numRoSigners = accountMetas.filter((m) => m.isSigner && !m.isWritable).length;
    const numRw = accountMetas.filter((m) => !m.isSigner && m.isWritable).length;

    const compiledInstructions = instructions.map((instruction) => {
      const programIdIndex = accountMap.get(instruction.programAddress)!;
      const accountIndices = instruction.accounts?.map((account) => accountMap.get(account.address)!) || [];

      return {
        programIdIndex,
        accounts: Buffer.from(accountIndices),
        data: Buffer.from(instruction.data || []),
      };
    });

    return {
      numRwSigners,
      numRoSigners,
      numRw,
      accounts,
      instructions: compiledInstructions,
      signerSeeds: [],
    } as any;
  }

  /**
   * Gets the address for a cron job by name.
   */
  async getCronJobForName(user: KeyPairSigner, cronName: string): Promise<Address | null> {
    try {
      const { pda: nameMappingAddress } = await this.connection.getPDAAndBump(CRON_PROGRAM_ADDRESS, [
        "cron_job_name_mapping",
        user.address,
        await this.hashCronName(cronName),
      ]);

      const cronJobNameMapping = await fetchMaybeCronJobNameMappingV0(this.connection.rpc, nameMappingAddress);

      if (!cronJobNameMapping.exists) {
        return null;
      }

      return cronJobNameMapping.data.cronJob;
    } catch (error) {
      throw new Error(`Error fetching cron job for name: ${cronName}`, { cause: error });
    }
  }

  /**
   * Funds a task queue with additional SOL.
   */
  async fundTaskQueue(user: KeyPairSigner, taskQueue: Address, amount: bigint): Promise<string> {
    const { getTransferSolInstruction } = await import("@solana-program/system");

    const transferInstruction = getTransferSolInstruction({
      source: user,
      destination: taskQueue,
      amount,
    });

    return this.connection.sendTransactionFromInstructions({
      feePayer: user as any,
      instructions: [transferInstruction],
    });
  }
}
