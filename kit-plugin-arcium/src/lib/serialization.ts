import { randomBytes } from "crypto";

export const deserializeLE = (bytes: Uint8Array | Buffer): bigint => {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result |= BigInt(bytes[i]) << (BigInt(i) * BigInt(8));
  }
  return result;
};

export const serializeLE = (value: bigint, length: number): Uint8Array => {
  const buffer = new Uint8Array(length);
  let remaining = value;
  for (let i = 0; i < length; i++) {
    buffer[i] = Number(remaining & BigInt(0xff));
    remaining >>= BigInt(8);
  }
  return buffer;
};

export const getRandomBigInt = (): bigint => {
  return deserializeLE(randomBytes(8));
};

export const getRandomNonce = (): Uint8Array => {
  return new Uint8Array(randomBytes(12));
};

export const getArciumClusterOffset = (): number => {
  const arciumClusterOffsetString = process.env.ARCIUM_CLUSTER_OFFSET;

  if (!arciumClusterOffsetString) {
    throw new Error("ARCIUM_CLUSTER_OFFSET environment variable is not set");
  }

  const arciumClusterOffset = Number(arciumClusterOffsetString);
  if (isNaN(arciumClusterOffset)) {
    throw new Error("ARCIUM_CLUSTER_OFFSET must be a valid integer");
  }

  return arciumClusterOffset;
};
