// Fetches a program's executable (.so / ELF) from a Solana cluster over RPC and writes it to a
// file, so LiteSVM-based tests can load the real mainnet program. Handles both the upgradeable
// loader (program -> programdata indirection, 45-byte header) and the legacy BPF loader (the
// account data is the ELF directly).
//
// Usage: node scripts/fetch-program.mjs <programId> <outPath> [cluster=mainnet]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { connect } from "solana-kite";
import { getBase64Encoder, getAddressDecoder } from "@solana/kit";

const UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const PROGRAMDATA_HEADER_LEN = 45; // u32 tag + u64 slot + 1-byte option + 32-byte authority

const [, , programId, outPath, cluster = "mainnet"] = process.argv;
if (!programId || !outPath) {
  console.error("Usage: node scripts/fetch-program.mjs <programId> <outPath> [cluster]");
  process.exit(1);
}

const base64Encoder = getBase64Encoder();
const addressDecoder = getAddressDecoder();
const connection = connect(cluster);

const programAccount = await connection.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
if (!programAccount.value) throw new Error(`Program ${programId} not found on ${cluster}`);

let elf;
if (programAccount.value.owner === UPGRADEABLE_LOADER) {
  // Program account data = u32 tag (2) + 32-byte programdata address.
  const programData = new Uint8Array(base64Encoder.encode(programAccount.value.data[0]));
  const programDataAddress = addressDecoder.decode(programData.slice(4, 36));
  const pd = await connection.rpc.getAccountInfo(programDataAddress, { encoding: "base64" }).send();
  if (!pd.value) throw new Error(`ProgramData ${programDataAddress} not found`);
  elf = new Uint8Array(base64Encoder.encode(pd.value.data[0])).slice(PROGRAMDATA_HEADER_LEN);
} else {
  elf = new Uint8Array(base64Encoder.encode(programAccount.value.data[0]));
}

if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, elf);
console.log(`Wrote ${elf.length} bytes to ${outPath} (program ${programId} from ${cluster})`);
