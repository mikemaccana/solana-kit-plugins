import type { Address, TransactionSendingSigner, Commitment, Instruction } from "@solana/kit";
import type { Connection } from "solana-kite";
import type { MultisigConfig, MultisigAccount, ProposalAccount } from "./types.js";
import { ProposalStatus } from "./types.js";
import { SQUADS_PROGRAM_ID } from "./constants.js";
import { getMultisigCreateV2Instruction } from "../generated/squads_multisig_program-client/instructions/multisigCreateV2.js";
import { getProposalCreateInstruction } from "../generated/squads_multisig_program-client/instructions/proposalCreate.js";
import { getProposalApproveInstruction } from "../generated/squads_multisig_program-client/instructions/proposalApprove.js";
import { getProposalRejectInstruction } from "../generated/squads_multisig_program-client/instructions/proposalReject.js";
import { getVaultTransactionCreateInstruction } from "../generated/squads_multisig_program-client/instructions/vaultTransactionCreate.js";
import { getVaultTransactionExecuteInstruction } from "../generated/squads_multisig_program-client/instructions/vaultTransactionExecute.js";
import { generateKeyPairSigner, address } from "@solana/kit";
import { fetchProgramConfig } from "../generated/squads_multisig_program-client/accounts/programConfig.js";
import { fetchMultisig } from "../generated/squads_multisig_program-client/accounts/multisig.js";
import { fetchProposal } from "../generated/squads_multisig_program-client/accounts/proposal.js";

export class SquadsClient {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Derives the program config PDA address
   */
  async getProgramConfigAddress(): Promise<Address> {
    const { pda } = await this.connection.getPDAAndBump(SQUADS_PROGRAM_ID, [
      "multisig",
      "program_config",
    ]);
    return pda;
  }

  /**
   * Derives the multisig PDA address
   */
  async getMultisigAddress(createKey: Address): Promise<Address> {
    const { pda } = await this.connection.getPDAAndBump(SQUADS_PROGRAM_ID, [
      "multisig",
      "multisig",
      createKey,
    ]);
    return pda;
  }

  /**
   * Derives the transaction PDA address
   */
  async getTransactionAddress(multisig: Address, transactionIndex: bigint): Promise<Address> {
    const { pda } = await this.connection.getPDAAndBump(SQUADS_PROGRAM_ID, [
      "multisig",
      multisig,
      "transaction",
      transactionIndex,
    ]);
    return pda;
  }

  /**
   * Derives the proposal PDA address
   */
  async getProposalAddress(multisig: Address, transactionIndex: bigint): Promise<Address> {
    const { pda } = await this.connection.getPDAAndBump(SQUADS_PROGRAM_ID, [
      "multisig",
      multisig,
      "transaction",
      transactionIndex,
      "proposal",
    ]);
    return pda;
  }

  /**
   * Derives the vault PDA address (index 0 is the default vault)
   */
  async getVaultAddress(multisig: Address, vaultIndex: number = 0): Promise<Address> {
    const vaultIndexBuffer = new Uint8Array([vaultIndex]);
    const { pda } = await this.connection.getPDAAndBump(SQUADS_PROGRAM_ID, [
      "multisig",
      multisig,
      "vault",
      vaultIndexBuffer,
    ]);
    return pda;
  }

  /**
   * Creates a new multisig wallet
   */
  async createMultisig({
    creator,
    config,
    commitment = "confirmed",
  }: {
    creator: TransactionSendingSigner;
    config: MultisigConfig;
    commitment?: Commitment;
  }): Promise<{ multisig: Address; signature: string }> {
    // Generate a unique create key for this multisig
    const createKey = await generateKeyPairSigner();

    // Derive the multisig PDA
    const multisigAddress = await this.getMultisigAddress(createKey.address);

    // Derive program config PDA
    const programConfigAddress = await this.getProgramConfigAddress();

    // Fetch program config to get treasury address
    const programConfig = await fetchProgramConfig(this.connection.rpc, programConfigAddress, { commitment });

    // Create the multisig instruction
    const instruction = getMultisigCreateV2Instruction({
      programConfig: programConfigAddress,
      treasury: programConfig.data.treasury,
      multisig: multisigAddress,
      createKey,
      creator,
      configAuthority: null,
      threshold: config.threshold,
      members: config.members.map((member) => ({ key: member, permissions: { mask: 7 } })),
      timeLock: config.timeLock ?? 0,
      rentCollector: config.rentCollector ?? null,
      memo: null,
    });

    // Send transaction
    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: creator,
      instructions: [instruction],
      commitment,
    });

    return {
      multisig: multisigAddress,
      signature,
    };
  }

  /**
   * Creates a new transaction proposal
   */
  async createProposal({
    multisig,
    creator,
    instructions,
    commitment = "confirmed",
  }: {
    multisig: Address;
    creator: TransactionSendingSigner;
    instructions: Array<Instruction>;
    commitment?: Commitment;
  }): Promise<{ proposal: Address; transactionIndex: bigint; signature: string }> {
    // Fetch current multisig to get transaction index
    const multisigAccount = await this.getMultisigAccount(multisig);
    const transactionIndex = multisigAccount.transactionIndex + 1n;

    // Derive proposal and transaction addresses
    const proposalAddress = await this.getProposalAddress(multisig, transactionIndex);
    const transactionAddress = await this.getTransactionAddress(multisig, transactionIndex);

    // Create proposal instruction
    const proposalInstruction = getProposalCreateInstruction({
      multisig,
      proposal: proposalAddress,
      creator,
      rentPayer: creator,
      transactionIndex,
      draft: false,
    });

    // Serialize instructions for vault transaction
    const transactionMessage = new Uint8Array(Buffer.from(JSON.stringify(instructions)));

    // Create vault transaction instruction
    const vaultTransactionInstruction = getVaultTransactionCreateInstruction({
      multisig,
      transaction: transactionAddress,
      creator,
      rentPayer: creator,
      args: {
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage,
        memo: null,
      },
    });

    // Send transaction
    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: creator,
      instructions: [proposalInstruction, vaultTransactionInstruction],
      commitment,
    });

    return {
      proposal: proposalAddress,
      transactionIndex,
      signature,
    };
  }

  /**
   * Approves a proposal
   */
  async approveProposal({
    multisig,
    transactionIndex,
    member,
    commitment = "confirmed",
  }: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }): Promise<string> {
    const proposalAddress = await this.getProposalAddress(multisig, transactionIndex);

    const instruction = getProposalApproveInstruction({
      multisig,
      member,
      proposal: proposalAddress,
      args: {
        memo: null,
      },
    });

    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: member,
      instructions: [instruction],
      commitment,
    });

    return signature;
  }

  /**
   * Rejects a proposal
   */
  async rejectProposal({
    multisig,
    transactionIndex,
    member,
    commitment = "confirmed",
  }: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }): Promise<string> {
    const proposalAddress = await this.getProposalAddress(multisig, transactionIndex);

    const instruction = getProposalRejectInstruction({
      multisig,
      member,
      proposal: proposalAddress,
      args: {
        memo: null,
      },
    });

    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: member,
      instructions: [instruction],
      commitment,
    });

    return signature;
  }

  /**
   * Executes an approved proposal
   */
  async executeProposal({
    multisig,
    transactionIndex,
    member,
    commitment = "confirmed",
  }: {
    multisig: Address;
    transactionIndex: bigint;
    member: TransactionSendingSigner;
    commitment?: Commitment;
  }): Promise<string> {
    const proposalAddress = await this.getProposalAddress(multisig, transactionIndex);
    const transactionAddress = await this.getTransactionAddress(multisig, transactionIndex);

    const instruction = getVaultTransactionExecuteInstruction({
      multisig,
      proposal: proposalAddress,
      transaction: transactionAddress,
      member,
    });

    const signature = await this.connection.sendTransactionFromInstructions({
      feePayer: member,
      instructions: [instruction],
      commitment,
    });

    return signature;
  }

  /**
   * Gets multisig account data
   */
  async getMultisigAccount(multisig: Address): Promise<MultisigAccount> {
    const account = await fetchMultisig(this.connection.rpc, multisig);

    const rentCollector =
      account.data.rentCollector.__option === "Some" ? account.data.rentCollector.value : null;

    return {
      address: multisig,
      threshold: account.data.threshold,
      members: account.data.members.map((member) => member.key),
      timeLock: account.data.timeLock,
      transactionIndex: account.data.transactionIndex,
      configAuthority: account.data.configAuthority,
      rentCollector,
    };
  }

  /**
   * Gets proposal account data
   */
  async getProposalAccount(proposal: Address): Promise<ProposalAccount> {
    const account = await fetchProposal(this.connection.rpc, proposal);

    const statusMap: Record<string, ProposalStatus> = {
      Active: ProposalStatus.Active,
      Approved: ProposalStatus.Approved,
      Rejected: ProposalStatus.Rejected,
      Cancelled: ProposalStatus.Cancelled,
      Executed: ProposalStatus.Executed,
    };

    const statusKey = account.data.status.__kind;
    const status = statusMap[statusKey] ?? ProposalStatus.Active;

    return {
      address: proposal,
      multisig: account.data.multisig,
      transactionIndex: account.data.transactionIndex,
      status,
      approved: account.data.approved,
      rejected: account.data.rejected,
      approvalCount: account.data.approved.length,
      rejectionCount: account.data.rejected.length,
    };
  }
}
