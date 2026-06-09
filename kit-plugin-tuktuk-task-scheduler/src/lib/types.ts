import type { Address, Instruction } from "@solana/kit";

export interface TukTukConfig {
  defaultTaskQueueName?: string;
  cluster?: string;
}

export type TaskTrigger =
  | { __kind: "Now" }
  | { __kind: "Timestamp"; fields: [bigint] };

/**
 * An address lookup table: its account address plus the addresses it stores.
 */
export interface AddressLookupTable {
  address: Address;
  addresses: Array<Address>;
}

export interface CompiledTransaction {
  instructions: Array<Instruction>;
  addressLookupTables: Array<AddressLookupTable>;
}

export interface TaskQueueParams {
  name: string;
  capacity: number;
  fundingAmount: bigint;
  crankReward: bigint;
}

export interface QueueTaskParams {
  trigger: TaskTrigger;
  transaction: CompiledTransaction | { url: string };
  crankReward?: bigint | null;
  freeTasks?: number;
  description?: string;
}

export interface CronJobParams {
  name: string;
  schedule: string;
  freeTasksPerTransaction: number;
  numTasksPerQueueCall: number;
}

export interface TaskInfo {
  taskId: number;
  taskAddress: Address;
  trigger: TaskTrigger;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
}
