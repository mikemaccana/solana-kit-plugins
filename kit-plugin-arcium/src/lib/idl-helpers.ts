import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const currentDir = dirname(fileURLToPath(import.meta.url));
const arciumIdl = JSON.parse(await readFile(join(currentDir, "../arcium.json"), "utf-8"));

export const getInstructionDiscriminator = (instructionName: string): Uint8Array => {
  const instruction = (arciumIdl as any).instructions.find(
    (ix: any) => ix.name === instructionName,
  );
  if (!instruction) {
    throw new Error(`Instruction "${instructionName}" not found in Arcium IDL`);
  }
  return new Uint8Array(instruction.discriminator);
};

export const getEventDiscriminator = (eventName: string): Uint8Array => {
  const event = (arciumIdl as any).events.find((ev: any) => ev.name === eventName);
  if (!event) {
    throw new Error(`Event "${eventName}" not found in Arcium IDL`);
  }
  return new Uint8Array(event.discriminator);
};

export const getInstructionArgMaxArrayLength = (
  instructionName: string,
  argName: string,
): number => {
  const instruction = (arciumIdl as any).instructions.find(
    (ix: any) => ix.name === instructionName,
  );
  if (!instruction) {
    throw new Error(`Instruction "${instructionName}" not found in Arcium IDL`);
  }
  const arg = instruction.args.find((a: any) => a.name === argName);
  if (!arg || !arg.type?.array || !Array.isArray(arg.type.array)) {
    throw new Error(`Arg "${argName}" not found or not an array type in instruction "${instructionName}"`);
  }
  return arg.type.array[1] as number;
};

export const MAX_UPLOAD_PER_TX_BYTES = getInstructionArgMaxArrayLength(
  "upload_circuit",
  "upload_data",
);

// These are Solana/Anchor constants, not from the IDL
export const MAX_REALLOC_PER_IX = 10240;
export const MAX_ACCOUNT_SIZE = 10485760;
export const MAX_EMBIGGEN_IX_PER_TX = 18;

/*
 * Computes a deterministic 4-byte offset for a circuit by hashing its name with SHA256.
 * This offset is used as a seed for deriving the computation definition account PDA.
 */
export const getComputationDefinitionAccountOffset = (circuitName: string): Uint8Array => {
  const hash = createHash("sha256").update(circuitName, "utf-8").digest();
  return new Uint8Array(hash.slice(0, 4));
};
