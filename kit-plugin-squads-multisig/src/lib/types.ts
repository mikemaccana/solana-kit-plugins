import type { Address, Commitment } from "@solana/kit";

/**
 * Configuration options for the Squads plugin
 */
export interface SquadsConfig {
  /**
   * Cluster to use (default: inherits from connection)
   */
  cluster?: string;
}

/**
 * Multisig configuration
 */
export interface MultisigConfig {
  /**
   * Number of members that must approve a transaction
   */
  threshold: number;

  /**
   * Array of member addresses
   */
  members: Array<Address>;

  /**
   * Time lock in seconds (default: 0 = no time lock)
   */
  timeLock?: number;

  /**
   * Rent collector address (optional)
   */
  rentCollector?: Address;
}

/**
 * Multisig account data
 */
export interface MultisigAccount {
  /**
   * The multisig PDA address
   */
  address: Address;

  /**
   * Number of members required to approve
   */
  threshold: number;

  /**
   * Array of member addresses
   */
  members: Array<Address>;

  /**
   * Time lock in seconds
   */
  timeLock: number;

  /**
   * Transaction index counter
   */
  transactionIndex: bigint;

  /**
   * Config authority (can modify multisig settings)
   */
  configAuthority: Address;

  /**
   * Rent collector address
   */
  rentCollector: Address | null;
}

/**
 * Proposal/Transaction status
 */
export enum ProposalStatus {
  Active = "Active",
  Approved = "Approved",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
  Executed = "Executed",
}

/**
 * Proposal account data
 */
export interface ProposalAccount {
  /**
   * The proposal PDA address
   */
  address: Address;

  /**
   * The multisig this proposal belongs to
   */
  multisig: Address;

  /**
   * Transaction index
   */
  transactionIndex: bigint;

  /**
   * Proposal status
   */
  status: ProposalStatus;

  /**
   * Members who have approved
   */
  approved: Array<Address>;

  /**
   * Members who have rejected
   */
  rejected: Array<Address>;

  /**
   * Number of approvals
   */
  approvalCount: number;

  /**
   * Number of rejections
   */
  rejectionCount: number;
}
