import { type Address, type TransactionSigner, type Instruction, AccountRole } from "@solana/kit";
import { getAddressEncoder } from "@solana/kit";
import { type Connection } from "solana-kite";
import {
  getComputationDefinitionAccountAddress,
  getComputationDefinitionRawAddress,
} from "./pda.js";
import {
  getInstructionDiscriminator,
  getComputationDefinitionAccountOffset,
  MAX_UPLOAD_PER_TX_BYTES,
  MAX_REALLOC_PER_IX,
  MAX_ACCOUNT_SIZE,
  MAX_EMBIGGEN_IX_PER_TX,
} from "./idl-helpers.js";
import { ARCIUM_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "./constants.js";

const buildCompDefOffsetAndPDAs = async (
  connection: Connection,
  compDefOffset: number,
  mxeProgramId: Address,
  rawCircuitIndex: number,
) => {
  const offsetBytes = new Uint8Array(4);
  new DataView(offsetBytes.buffer).setUint32(0, compDefOffset, true);

  const compDefAcc = await getComputationDefinitionAccountAddress(
    connection,
    mxeProgramId,
    new Uint8Array(offsetBytes),
  );
  const compDefRaw = await getComputationDefinitionRawAddress(
    connection,
    compDefAcc,
    rawCircuitIndex,
  );

  return { offsetBytes, compDefAcc, compDefRaw };
};

const encodeInstructionHeader = (
  discriminator: Uint8Array,
  compDefOffset: number,
  mxeProgramId: Address,
) => {
  const offsetBytes = new Uint8Array(4);
  new DataView(offsetBytes.buffer).setUint32(0, compDefOffset, true);

  const mxeProgramBytes = getAddressEncoder().encode(mxeProgramId);

  return { offsetBytes, mxeProgramBytes };
};

export const buildFinalizeCompDefInstruction = async (
  connection: Connection,
  signer: TransactionSigner,
  compDefOffset: number,
  mxeProgramId: Address,
): Promise<Instruction> => {
  const discriminator = getInstructionDiscriminator("finalize_computation_definition");
  const { offsetBytes, mxeProgramBytes } = encodeInstructionHeader(
    discriminator,
    compDefOffset,
    mxeProgramId,
  );

  const instructionData = new Uint8Array(
    discriminator.length + offsetBytes.length + mxeProgramBytes.length,
  );
  instructionData.set(discriminator, 0);
  instructionData.set(offsetBytes, discriminator.length);
  instructionData.set(mxeProgramBytes, discriminator.length + offsetBytes.length);

  const compDefAccOffsetBytes = new Uint8Array(4);
  new DataView(compDefAccOffsetBytes.buffer).setUint32(0, compDefOffset, true);

  const compDefAcc = await getComputationDefinitionAccountAddress(
    connection,
    mxeProgramId,
    compDefAccOffsetBytes,
  );
  const compDefRaw = await getComputationDefinitionRawAddress(connection, compDefAcc, 0);

  return {
    programAddress: ARCIUM_PROGRAM_ID,
    data: instructionData,
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: compDefAcc, role: AccountRole.WRITABLE },
      { address: compDefRaw, role: AccountRole.READONLY },
    ],
  };
};

const buildInitRawCircuitAccInstruction = async (
  connection: Connection,
  signer: TransactionSigner,
  compDefOffset: number,
  mxeProgramId: Address,
  rawCircuitIndex: number,
): Promise<Instruction> => {
  const discriminator = getInstructionDiscriminator("init_raw_circuit_acc");
  const { offsetBytes, mxeProgramBytes } = encodeInstructionHeader(
    discriminator,
    compDefOffset,
    mxeProgramId,
  );
  const indexBytes = new Uint8Array([rawCircuitIndex]);

  const instructionData = new Uint8Array(
    discriminator.length + offsetBytes.length + mxeProgramBytes.length + indexBytes.length,
  );
  instructionData.set(discriminator, 0);
  instructionData.set(offsetBytes, discriminator.length);
  instructionData.set(mxeProgramBytes, discriminator.length + offsetBytes.length);
  instructionData.set(
    indexBytes,
    discriminator.length + offsetBytes.length + mxeProgramBytes.length,
  );

  const { compDefAcc, compDefRaw } = await buildCompDefOffsetAndPDAs(
    connection,
    compDefOffset,
    mxeProgramId,
    rawCircuitIndex,
  );

  return {
    programAddress: ARCIUM_PROGRAM_ID,
    data: instructionData,
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: compDefAcc, role: AccountRole.READONLY },
      { address: compDefRaw, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
  };
};

const buildEmbiggenRawCircuitAccInstruction = async (
  connection: Connection,
  signer: TransactionSigner,
  compDefOffset: number,
  mxeProgramId: Address,
  rawCircuitIndex: number,
): Promise<Instruction> => {
  const discriminator = getInstructionDiscriminator("embiggen_raw_circuit_acc");
  const { offsetBytes, mxeProgramBytes } = encodeInstructionHeader(
    discriminator,
    compDefOffset,
    mxeProgramId,
  );
  const indexBytes = new Uint8Array([rawCircuitIndex]);

  const instructionData = new Uint8Array(
    discriminator.length + offsetBytes.length + mxeProgramBytes.length + indexBytes.length,
  );
  instructionData.set(discriminator, 0);
  instructionData.set(offsetBytes, discriminator.length);
  instructionData.set(mxeProgramBytes, discriminator.length + offsetBytes.length);
  instructionData.set(
    indexBytes,
    discriminator.length + offsetBytes.length + mxeProgramBytes.length,
  );

  const { compDefAcc, compDefRaw } = await buildCompDefOffsetAndPDAs(
    connection,
    compDefOffset,
    mxeProgramId,
    rawCircuitIndex,
  );

  return {
    programAddress: ARCIUM_PROGRAM_ID,
    data: instructionData,
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: compDefAcc, role: AccountRole.READONLY },
      { address: compDefRaw, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
  };
};

const buildUploadCircuitInstruction = async (
  connection: Connection,
  signer: TransactionSigner,
  compDefOffset: number,
  mxeProgramId: Address,
  rawCircuitIndex: number,
  uploadData: Uint8Array,
  offset: number,
): Promise<Instruction> => {
  if (uploadData.length > MAX_UPLOAD_PER_TX_BYTES) {
    throw new Error(`Upload data must be ${MAX_UPLOAD_PER_TX_BYTES} bytes or less per transaction`);
  }

  const paddedData = new Uint8Array(MAX_UPLOAD_PER_TX_BYTES);
  paddedData.set(uploadData);

  const discriminator = getInstructionDiscriminator("upload_circuit");
  const { offsetBytes: compOffsetBytes, mxeProgramBytes } = encodeInstructionHeader(
    discriminator,
    compDefOffset,
    mxeProgramId,
  );
  const indexBytes = new Uint8Array([rawCircuitIndex]);

  const uploadOffsetBytes = new Uint8Array(4);
  new DataView(uploadOffsetBytes.buffer).setUint32(0, offset, true);

  const instructionData = new Uint8Array(
    discriminator.length +
      compOffsetBytes.length +
      mxeProgramBytes.length +
      indexBytes.length +
      paddedData.length +
      uploadOffsetBytes.length,
  );

  let pos = 0;
  instructionData.set(discriminator, pos);
  pos += discriminator.length;
  instructionData.set(compOffsetBytes, pos);
  pos += compOffsetBytes.length;
  instructionData.set(mxeProgramBytes, pos);
  pos += mxeProgramBytes.length;
  instructionData.set(indexBytes, pos);
  pos += indexBytes.length;
  instructionData.set(paddedData, pos);
  pos += paddedData.length;
  instructionData.set(uploadOffsetBytes, pos);

  const { compDefAcc, compDefRaw } = await buildCompDefOffsetAndPDAs(
    connection,
    compDefOffset,
    mxeProgramId,
    rawCircuitIndex,
  );

  return {
    programAddress: ARCIUM_PROGRAM_ID,
    data: instructionData,
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: compDefAcc, role: AccountRole.READONLY },
      { address: compDefRaw, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
  };
};

const uploadToCircuitAcc = async (
  connection: Connection,
  signer: TransactionSigner,
  rawCircuitPart: Uint8Array,
  rawCircuitIndex: number,
  compDefOffset: number,
  mxeProgramId: Address,
  logging: boolean,
  chunkSize: number,
): Promise<Array<string>> => {
  const signatures: Array<string> = [];

  const initInstruction = await buildInitRawCircuitAccInstruction(
    connection,
    signer,
    compDefOffset,
    mxeProgramId,
    rawCircuitIndex,
  );

  const initSignature = await connection.sendTransactionFromInstructions({
    feePayer: signer,
    instructions: [initInstruction],
    skipPreflight: true,
  });
  signatures.push(initSignature);

  if (logging) {
    console.log(`Initiated raw circuit account with index ${rawCircuitIndex}`);
  }

  if (rawCircuitPart.length > MAX_REALLOC_PER_IX) {
    const resizeTxCount = Math.ceil(
      rawCircuitPart.length / (MAX_REALLOC_PER_IX * MAX_EMBIGGEN_IX_PER_TX),
    );

    for (let i = 0; i < resizeTxCount; i++) {
      if (logging) {
        console.log(`Sending resize transaction ${i + 1} of ${resizeTxCount}`);
      }

      const currentSize = MAX_REALLOC_PER_IX + i * (MAX_REALLOC_PER_IX * MAX_EMBIGGEN_IX_PER_TX);
      const resizeSize = Math.min(
        rawCircuitPart.length - currentSize,
        MAX_EMBIGGEN_IX_PER_TX * MAX_REALLOC_PER_IX,
      );
      const instructionCount = Math.ceil(resizeSize / MAX_REALLOC_PER_IX);

      const embiggenInstructions: Array<Instruction> = await Promise.all(
        Array.from({ length: instructionCount }, () =>
          buildEmbiggenRawCircuitAccInstruction(
            connection,
            signer,
            compDefOffset,
            mxeProgramId,
            rawCircuitIndex,
          ),
        ),
      );

      const resizeSignature = await connection.sendTransactionFromInstructions({
        feePayer: signer,
        instructions: embiggenInstructions,
        skipPreflight: true,
      });
      signatures.push(resizeSignature);

      if (logging) {
        console.log(`Sent resize transaction ${i + 1} of ${resizeTxCount}`);
      }
    }
  }

  if (logging) {
    console.log("Done sending resize transactions");
  }

  const uploadTxCount = Math.ceil(rawCircuitPart.length / MAX_UPLOAD_PER_TX_BYTES);

  if (logging) {
    console.log(`Sending ${uploadTxCount} upload transactions`);
  }

  for (let i = 0; i < uploadTxCount; i += chunkSize) {
    if (logging) {
      console.log(
        `Sending chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(uploadTxCount / chunkSize)}`,
      );
    }

    const currentChunkSize = Math.min(chunkSize, uploadTxCount - i);
    const uploadPromises: Array<Promise<string>> = Array.from(
      { length: currentChunkSize },
      (_, j) => {
        const circuitOffset = MAX_UPLOAD_PER_TX_BYTES * (i + j);
        const slice = rawCircuitPart.subarray(
          circuitOffset,
          Math.min(circuitOffset + MAX_UPLOAD_PER_TX_BYTES, rawCircuitPart.length),
        );

        return buildUploadCircuitInstruction(
          connection,
          signer,
          compDefOffset,
          mxeProgramId,
          rawCircuitIndex,
          slice,
          circuitOffset,
        ).then((instruction) =>
          connection.sendTransactionFromInstructions({
            feePayer: signer,
            instructions: [instruction],
            skipPreflight: true,
          }),
        );
      },
    );

    const chunkSignatures = await Promise.all(uploadPromises);
    signatures.push(...chunkSignatures);

    if (logging) {
      console.log(
        `Done sending chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(uploadTxCount / chunkSize)}`,
      );
    }
  }

  return signatures;
};

export const uploadCircuit = async (
  connection: Connection,
  signer: TransactionSigner,
  circuitName: string,
  mxeProgramId: Address,
  rawCircuit: Uint8Array,
  logging: boolean = true,
  chunkSize: number = 500,
): Promise<Array<string>> => {
  const compDefOffsetBytes = getComputationDefinitionAccountOffset(circuitName);
  const compDefOffset = Buffer.from(compDefOffsetBytes).readUInt32LE(0);

  // Each account can hold MAX_ACCOUNT_SIZE - 9 bytes (9 bytes overhead for account header)
  const bytesPerAccount = MAX_ACCOUNT_SIZE - 9;
  const numAccounts = Math.ceil(rawCircuit.length / bytesPerAccount);

  if (logging) {
    console.log(
      `Uploading ${circuitName} circuit (${rawCircuit.length} bytes) across ${numAccounts} accounts`,
    );
  }

  const uploadPromises: Array<Promise<Array<string>>> = Array.from(
    { length: numAccounts },
    (_, i) => {
      const start = i * bytesPerAccount;
      const end = Math.min((i + 1) * bytesPerAccount, rawCircuit.length);
      return uploadToCircuitAcc(
        connection,
        signer,
        rawCircuit.subarray(start, end),
        i,
        compDefOffset,
        mxeProgramId,
        logging,
        chunkSize,
      );
    },
  );

  const allPartSignatures = await Promise.all(uploadPromises);
  const signatures = allPartSignatures.flat();

  if (logging) {
    console.log(`Finalizing ${circuitName} computation definition`);
  }

  const finalizeInstruction = await buildFinalizeCompDefInstruction(
    connection,
    signer,
    compDefOffset,
    mxeProgramId,
  );

  const finalizeSignature = await connection.sendTransactionFromInstructions({
    feePayer: signer,
    instructions: [finalizeInstruction],
    skipPreflight: true,
  });
  signatures.push(finalizeSignature);

  if (logging) {
    console.log(`Uploaded ${circuitName} circuit with ${signatures.length} transactions total`);
  }

  return signatures;
};
