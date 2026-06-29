// Regenerates the Codama clients in src/generated from the on-disk Anchor IDLs
// in idls/. This plugin uses two programs (tuktuk and cron), each with its own
// client. Run with `npm run generate`.
//
// @codama/renderers-js renders a full package scaffold (package.json + src/generated)
// into its target directory, so we render into a temp directory and then copy just the
// generated client files into place. This keeps the checked-in clients reproducible and
// lets CI verify they match the IDLs (regenerate + `git diff --exit-code`).
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const clients = [
  { idl: "./idls/tuktuk.json", out: "./src/generated/tuktuk-client" },
  { idl: "./idls/cron.json", out: "./src/generated/cron-client" },
];

for (const { idl, out } of clients) {
  const idlPath = fileURLToPath(new URL(idl, import.meta.url));
  const clientDir = fileURLToPath(new URL(out, import.meta.url));
  const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));
  const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

  const scratch = mkdtempSync(join(tmpdir(), "codama-tuktuk-"));
  try {
    // renderVisitor is asynchronous, so the accept call must be awaited.
    await codama.accept(renderVisitor(scratch));
    rmSync(clientDir, { recursive: true, force: true });
    cpSync(join(scratch, "src", "generated"), clientDir, { recursive: true });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`Generated client into ${clientDir}`);
}
