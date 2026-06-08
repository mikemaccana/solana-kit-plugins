import { type Address } from "@solana/kit";
import { type Connection } from "solana-kite";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  ARCIUM_PROGRAM_ID,
  MXE_ACCOUNT_SEED,
  COMPUTATION_ACCOUNT_SEED,
  COMPUTATION_DEFINITION_ACCOUNT_SEED,
  COMPUTATION_DEFINITION_RAW_SEED,
  INTERNAL_SEEDS,
} from "./constants.js";

const getArciumPDA = async (
  connection: Connection,
  seeds: Array<string | Address | Uint8Array>,
): Promise<Address> => {
  const result = await connection.getPDAAndBump(ARCIUM_PROGRAM_ID, seeds);
  return result.pda;
};

const numberToLE8ByteArray = (num: bigint): Uint8Array => {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, num, true);
  return new Uint8Array(buffer);
};

const clusterOffsetToBytes = (clusterOffset: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, clusterOffset, true);
  return bytes;
};

export const getMXEAccountAddress = async (
  connection: Connection,
  programId: Address,
): Promise<Address> => {
  const result = await connection.getPDAAndBump(ARCIUM_PROGRAM_ID, [
    MXE_ACCOUNT_SEED,
    programId,
  ]);
  return result.pda;
};

export const getMXELutAccountAddress = async (
  programId: Address,
  artifactsDir: string,
): Promise<Address> => {
  const artifactPath = join(artifactsDir, "mxe_lut_acc.json");
  try {
    const artifact = JSON.parse(await readFile(artifactPath, "utf-8"));
    return artifact.pubkey as Address;
  } catch (thrownObject) {
    const message = thrownObject instanceof Error ? thrownObject.message : String(thrownObject);
    throw new Error(
      `Failed to read MXE LUT account from ${artifactPath}. ` +
        `Ensure Arcium nodes have been initialized and genesis accounts created. ` +
        `Original error: ${message}`,
    );
  }
};

export const getComputationAccountAddress = async (
  connection: Connection,
  clusterOffset: number,
  computationOffset: bigint,
): Promise<Address> => {
  return getArciumPDA(connection, [
    COMPUTATION_ACCOUNT_SEED,
    clusterOffsetToBytes(clusterOffset),
    numberToLE8ByteArray(computationOffset),
  ]);
};

export const getMempoolAccountAddress = async (
  connection: Connection,
  clusterOffset: number,
): Promise<Address> => {
  return getArciumPDA(connection, [
    INTERNAL_SEEDS.MEMPOOL,
    clusterOffsetToBytes(clusterOffset),
  ]);
};

export const getExecutingPoolAccountAddress = async (
  connection: Connection,
  clusterOffset: number,
): Promise<Address> => {
  return getArciumPDA(connection, [
    INTERNAL_SEEDS.EXECUTING_POOL,
    clusterOffsetToBytes(clusterOffset),
  ]);
};

export const getClusterAccountAddress = async (
  connection: Connection,
  clusterOffset: number,
): Promise<Address> => {
  return getArciumPDA(connection, [
    INTERNAL_SEEDS.CLUSTER,
    clusterOffsetToBytes(clusterOffset),
  ]);
};

export const getComputationDefinitionAccountAddress = async (
  connection: Connection,
  mxeProgramId: Address,
  offset: Uint8Array,
): Promise<Address> => {
  return getArciumPDA(connection, [
    COMPUTATION_DEFINITION_ACCOUNT_SEED,
    mxeProgramId,
    offset,
  ]);
};

export const getComputationDefinitionRawAddress = async (
  connection: Connection,
  compDefAcc: Address,
  rawCircuitIndex: number,
): Promise<Address> => {
  const indexBytes = new Uint8Array(1);
  indexBytes[0] = rawCircuitIndex;
  return getArciumPDA(connection, [COMPUTATION_DEFINITION_RAW_SEED, compDefAcc, indexBytes]);
};
