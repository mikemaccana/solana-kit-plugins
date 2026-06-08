import { address } from "@solana/kit";

export const ARCIUM_PROGRAM_ID = address("Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ");

export const MXE_ACCOUNT_SEED = "MXEAccount";
export const COMPUTATION_ACCOUNT_SEED = "ComputationAccount";
export const COMPUTATION_DEFINITION_ACCOUNT_SEED = "ComputationDefinitionAccount";
export const COMPUTATION_DEFINITION_RAW_SEED = "ComputationDefinitionRaw";

const MEMPOOL_SEED = "Mempool";
const EXECUTING_POOL_SEED = "Execpool";
const CLUSTER_SEED = "Cluster";

export const INTERNAL_SEEDS = {
  MEMPOOL: MEMPOOL_SEED,
  EXECUTING_POOL: EXECUTING_POOL_SEED,
  CLUSTER: CLUSTER_SEED,
} as const;

export const ADDRESS_LOOKUP_TABLE_PROGRAM_ID = address("AddressLookupTab1e1111111111111111111111111");
export const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");
