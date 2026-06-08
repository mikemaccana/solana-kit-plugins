import { type Address, type TransactionSigner, type Instruction } from "@solana/kit";
import { type Connection } from "solana-kite";
import { type ClientSideKeys, getMXEPublicKeyWithRetry, makeClientSideKeys } from "./encryption.js";
import {
  getMXEAccountAddress,
  getMXELutAccountAddress,
  getComputationAccountAddress,
  getMempoolAccountAddress,
  getExecutingPoolAccountAddress,
  getClusterAccountAddress,
  getComputationDefinitionAccountAddress,
  getComputationDefinitionRawAddress,
} from "./pda.js";
import {
  awaitComputationFinalization,
  awaitComputationFinalizationSubscription,
} from "./events.js";
import { buildFinalizeCompDefInstruction, uploadCircuit } from "./upload-circuit.js";
import { getArciumClusterOffset } from "./serialization.js";

export interface ArciumPluginConfig {
  /*
   * Path to the directory containing Arcium genesis artifacts (e.g. mxe_lut_acc.json).
   * Required when calling getMXELutAccountAddress.
   */
  artifactsDir?: string;
  /*
   * The Arcium cluster offset. Defaults to reading ARCIUM_CLUSTER_OFFSET from the environment.
   */
  clusterOffset?: number;
}

export class ArciumClient {
  private connection: Connection;
  private config: ArciumPluginConfig;
  readonly clusterOffset: number;
  readonly clusterAccount: Address;
  readonly mempoolAccount: Address;
  readonly executingPool: Address;

  private constructor(
    connection: Connection,
    config: ArciumPluginConfig,
    clusterOffset: number,
    clusterAccount: Address,
    mempoolAccount: Address,
    executingPool: Address,
  ) {
    this.connection = connection;
    this.config = config;
    this.clusterOffset = clusterOffset;
    this.clusterAccount = clusterAccount;
    this.mempoolAccount = mempoolAccount;
    this.executingPool = executingPool;
  }

  static async create(connection: Connection, config: ArciumPluginConfig = {}): Promise<ArciumClient> {
    const clusterOffset = config.clusterOffset ?? getArciumClusterOffset();
    const [clusterAccount, mempoolAccount, executingPool] = await Promise.all([
      getClusterAccountAddress(connection, clusterOffset),
      getMempoolAccountAddress(connection, clusterOffset),
      getExecutingPoolAccountAddress(connection, clusterOffset),
    ]);
    return new ArciumClient(connection, config, clusterOffset, clusterAccount, mempoolAccount, executingPool);
  }

  getMXEAccountAddress(programId: Address): Promise<Address> {
    return getMXEAccountAddress(this.connection, programId);
  }

  getMXELutAccountAddress(programId: Address): Promise<Address> {
    if (!this.config.artifactsDir) {
      throw new Error(
        "artifactsDir must be provided in ArciumPluginConfig to call getMXELutAccountAddress",
      );
    }
    return getMXELutAccountAddress(programId, this.config.artifactsDir);
  }

  getMXEPublicKeyWithRetry(
    programId: Address,
    maxRetries?: number,
    retryDelayMs?: number,
  ): Promise<Uint8Array> {
    return getMXEPublicKeyWithRetry(this.connection, programId, maxRetries, retryDelayMs);
  }

  makeClientSideKeys(programId: Address): Promise<ClientSideKeys> {
    return makeClientSideKeys(this.connection, programId);
  }

  getComputationAccountAddress(computationOffset: bigint): Promise<Address> {
    return getComputationAccountAddress(this.connection, this.clusterOffset, computationOffset);
  }

  getComputationDefinitionAccountAddress(
    mxeProgramId: Address,
    offset: Uint8Array,
  ): Promise<Address> {
    return getComputationDefinitionAccountAddress(this.connection, mxeProgramId, offset);
  }

  getComputationDefinitionRawAddress(
    compDefAcc: Address,
    rawCircuitIndex: number,
  ): Promise<Address> {
    return getComputationDefinitionRawAddress(this.connection, compDefAcc, rawCircuitIndex);
  }

  awaitComputationFinalization(
    computationOffset: bigint,
    mxeProgramId: Address,
    commitment?: "processed" | "confirmed" | "finalized",
  ): Promise<string> {
    return awaitComputationFinalization(
      this.connection,
      computationOffset,
      mxeProgramId,
      commitment,
    );
  }

  awaitComputationFinalizationSubscription(
    computationOffset: bigint,
    mxeProgramId: Address,
    commitment?: "processed" | "confirmed" | "finalized",
  ): Promise<string> {
    return awaitComputationFinalizationSubscription(
      this.connection,
      computationOffset,
      mxeProgramId,
      commitment,
    );
  }

  buildFinalizeCompDefInstruction(
    signer: TransactionSigner,
    compDefOffset: number,
    mxeProgramId: Address,
  ): Promise<Instruction> {
    return buildFinalizeCompDefInstruction(this.connection, signer, compDefOffset, mxeProgramId);
  }

  uploadCircuit(
    signer: TransactionSigner,
    circuitName: string,
    mxeProgramId: Address,
    rawCircuit: Uint8Array,
    logging?: boolean,
    chunkSize?: number,
  ): Promise<Array<string>> {
    return uploadCircuit(
      this.connection,
      signer,
      circuitName,
      mxeProgramId,
      rawCircuit,
      logging,
      chunkSize,
    );
  }
}
