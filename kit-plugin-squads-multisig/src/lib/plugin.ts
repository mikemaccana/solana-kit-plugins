import { extendClient } from "@solana/kit";
import type { Address, TransactionSendingSigner, Commitment, Instruction } from "@solana/kit";
import type { Connection } from "solana-kite";
import { SquadsClient } from "./squads-client.js";
import type { SquadsConfig, MultisigConfig, MultisigAccount, ProposalAccount } from "./types.js";

export interface SquadsMethods {
  squads: SquadsClient;

  /**
   * Creates a new multisig wallet
   */
  createMultisig: (params: {
    creator: TransactionSendingSigner;
    config: MultisigConfig;
    commitment?: Commitment;
  }) => Promise<{ multisig: Address; signature: string }>;

  /**
   * Creates a new transaction proposal
   */
  createProposal: (params: {
    multisig: Address;
    creator: TransactionSendingSigner;
    instructions: Array<Instruction>;
    commitment?: Commitment;
  }) => Promise<{ proposal: Address; transactionIndex: bigint; signature: string }>;

  /**
   * Approves a proposal
   */
  approveProposal: (params: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }) => Promise<string>;

  /**
   * Rejects a proposal
   */
  rejectProposal: (params: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }) => Promise<string>;

  /**
   * Executes an approved proposal
   */
  executeProposal: (params: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }) => Promise<string>;

  /**
   * Gets multisig account data
   */
  getMultisigAccount: (multisig: Address) => Promise<MultisigAccount>;

  /**
   * Gets proposal account data
   */
  getProposalAccount: (proposal: Address) => Promise<ProposalAccount>;

  /**
   * Derives the multisig PDA address
   */
  getMultisigAddress: (createKey: Address) => Promise<Address>;

  /**
   * Derives the proposal PDA address
   */
  getProposalAddress: (multisig: Address, transactionIndex: bigint) => Promise<Address>;

  /**
   * Derives the vault PDA address
   */
  getVaultAddress: (multisig: Address, vaultIndex?: number) => Promise<Address>;
}

export type ConnectionWithSquads = Connection & SquadsMethods;

/**
 * Creates a Squads multisig plugin for Solana Kite.
 *
 * This plugin provides a clean, web3.js-free interface to Squads Protocol v4,
 * enabling multisig wallet management using Solana Kit.
 *
 * @param config - Configuration options
 * @param config.cluster - Cluster to use (default: inherits from connection)
 * @returns A plugin function that extends connections with Squads functionality
 *
 * @example
 * ```typescript
 * import { connect } from "solana-kite";
 * import { createKiteSquadsPlugin } from "solana-kite-squads-multisig";
 *
 * const client = connect("devnet").use(createKiteSquadsPlugin());
 *
 * // Create a 2-of-3 multisig
 * const { multisig } = await client.createMultisig({
 *   creator: wallet,
 *   config: {
 *     threshold: 2,
 *     members: [member1.address, member2.address, member3.address]
 *   }
 * });
 *
 * // Create a proposal
 * const { proposal, transactionIndex } = await client.createProposal({
 *   multisig,
 *   creator: member1,
 *   instructions: [transferInstruction]
 * });
 *
 * // Approve and execute
 * await client.approveProposal({ multisig, transactionIndex, member: member2 });
 * await client.executeProposal({ multisig, transactionIndex, member: member1 });
 * ```
 */
export const squadsMultisig = (config: SquadsConfig = {}) => {
  return <T extends Connection>(connection: T) => {
    const squadsClient = new SquadsClient(connection);

    const createMultisig = async (params: {
      creator: TransactionSendingSigner;
      config: MultisigConfig;
      commitment?: Commitment;
    }) => {
      return squadsClient.createMultisig(params);
    };

    const createProposal = async (params: {
      multisig: Address;
      creator: TransactionSendingSigner;
      instructions: Array<Instruction>;
      commitment?: Commitment;
    }) => {
      return squadsClient.createProposal(params);
    };

    const approveProposal = async (params: {
      multisig: Address;
      transactionIndex: bigint;
      member: TransactionSendingSigner;
      commitment?: Commitment;
    }) => {
      return squadsClient.approveProposal(params);
    };

    const rejectProposal = async (params: {
      multisig: Address;
      transactionIndex: bigint;
      member: TransactionSendingSigner;
      commitment?: Commitment;
    }) => {
      return squadsClient.rejectProposal(params);
    };

    const executeProposal = async (params: {
      multisig: Address;
      transactionIndex: bigint;
      member: TransactionSendingSigner;
      commitment?: Commitment;
    }) => {
      return squadsClient.executeProposal(params);
    };

    const getMultisigAccount = async (multisig: Address) => {
      return squadsClient.getMultisigAccount(multisig);
    };

    const getProposalAccount = async (proposal: Address) => {
      return squadsClient.getProposalAccount(proposal);
    };

    const getMultisigAddress = async (createKey: Address) => {
      return squadsClient.getMultisigAddress(createKey);
    };

    const getProposalAddress = async (multisig: Address, transactionIndex: bigint) => {
      return squadsClient.getProposalAddress(multisig, transactionIndex);
    };

    const getVaultAddress = async (multisig: Address, vaultIndex?: number) => {
      return squadsClient.getVaultAddress(multisig, vaultIndex);
    };

    return extendClient(connection, {
      squads: squadsClient,
      createMultisig,
      createProposal,
      approveProposal,
      rejectProposal,
      executeProposal,
      getMultisigAccount,
      getProposalAccount,
      getMultisigAddress,
      getProposalAddress,
      getVaultAddress,
    });
  };
};

/**
 * @deprecated Use {@link squadsMultisig} instead. Kept for backward compatibility.
 */
export const createKiteSquadsPlugin = squadsMultisig;
