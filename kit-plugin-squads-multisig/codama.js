// Regenerates the Codama client in src/generated/squads_multisig_program-client
// from the on-disk Anchor IDL in idls/. Run with `npm run generate`.
//
// @codama/renderers-js renders a full package scaffold (package.json + src/generated)
// into its target directory, so we render into a temp directory and then copy just the
// generated client files into place. This keeps the checked-in client reproducible and
// lets CI verify it matches the IDL (regenerate + `git diff --exit-code`).
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const idlPath = fileURLToPath(new URL("./idls/squads_multisig_program.json", import.meta.url));
const clientDir = fileURLToPath(new URL("./src/generated/squads_multisig_program-client", import.meta.url));

const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));
const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

const scratch = mkdtempSync(join(tmpdir(), "codama-squads-"));
try {
  // renderVisitor is asynchronous, so the accept call must be awaited.
  await codama.accept(renderVisitor(scratch));
  rmSync(clientDir, { recursive: true, force: true });
  cpSync(join(scratch, "src", "generated"), clientDir, { recursive: true });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`Generated squads_multisig_program client into ${clientDir}`);
