import { x25519 } from "@noble/curves/ed25519";
import { type Address } from "@solana/kit";
import { type Connection } from "solana-kite";
import { setTimeout } from "timers/promises";
import { getMXEAccountAddress } from "./pda.js";
import { RescueCipher } from "./rescue-cipher.js";

export interface ClientSideKeys {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  sharedSecret: Uint8Array;
  cipher: RescueCipher;
}

/*
 * Fetches the MXE's x25519 public key by reading the MXEAccount onchain.
 *
 * MXEAccount binary layout:
 * - discriminator: 8 bytes
 * - cluster: Option<u32> = 1 byte discriminator + optional 4 bytes
 * - keygen_offset: u64 = 8 bytes
 * - key_recovery_init_offset: u64 = 8 bytes
 * - mxe_program_id: Pubkey = 32 bytes
 * - authority: Option<Pubkey> = 1 byte discriminator + optional 32 bytes
 * - utility_pubkeys: SetUnset<UtilityPubkeys>
 *   - variant 0 (Set): x25519_pubkey starts at current offset
 *   - variant 1 (Unset): x25519_pubkey + 160 bytes + Vec<bool> length check
 */
export const getMXEPublicKeyWithRetry = async (
  connection: Connection,
  programId: Address,
  maxRetries: number = 20,
  retryDelayMs: number = 500,
): Promise<Uint8Array> => {
  const mxeAccountAddress = await getMXEAccountAddress(connection, programId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const accountInfo = await connection.rpc
        .getAccountInfo(mxeAccountAddress, { encoding: "base64" })
        .send();

      if (!accountInfo.value) {
        throw new Error(`MXE account not found at ${mxeAccountAddress}`);
      }

      const accountData = Buffer.from(accountInfo.value.data[0], "base64");

      let offset = 8;

      offset += 1;
      if (accountData[offset - 1] === 1) {
        offset += 4;
      }

      offset += 8; // keygen_offset
      offset += 8; // key_recovery_init_offset
      offset += 32; // mxe_program_id

      const authorityOption = accountData[offset];
      offset += 1;
      if (authorityOption === 1) {
        offset += 32;
      }

      const utilityPubkeysVariant = accountData[offset];
      offset += 1;

      const x25519Pubkey = accountData.subarray(offset, offset + 32);

      if (utilityPubkeysVariant === 0) {
        return new Uint8Array(x25519Pubkey);
      } else if (utilityPubkeysVariant === 1) {
        const utilityPubkeysSize = 160;
        const vecBoolOffset = offset + utilityPubkeysSize;
        const vecLength = accountData.readUInt32LE(vecBoolOffset);
        const boolsOffset = vecBoolOffset + 4;

        const allTrue = Array.from({ length: vecLength }, (_, i) => accountData[boolsOffset + i] !== 0).every(Boolean);

        if (allTrue) {
          return new Uint8Array(x25519Pubkey);
        } else {
          throw new Error("MXE utility pubkeys are not fully initialized yet");
        }
      } else {
        throw new Error(`Invalid SetUnset variant: ${utilityPubkeysVariant}`);
      }
    } catch (thrownObject) {
      console.log(`Attempt ${attempt} failed to fetch MXE public key:`, thrownObject);
    }

    if (attempt < maxRetries) {
      console.log(`Retrying in ${retryDelayMs}ms... (attempt ${attempt}/${maxRetries})`);
      await setTimeout(retryDelayMs);
    }
  }

  throw new Error(`Failed to fetch MXE public key after ${maxRetries} attempts`);
};

export const makeClientSideKeys = async (
  connection: Connection,
  programId: Address,
): Promise<ClientSideKeys> => {
  const mxePublicKey = await getMXEPublicKeyWithRetry(connection, programId);

  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);

  return { privateKey, publicKey, sharedSecret, cipher: new RescueCipher(sharedSecret) };
};
