import { rm } from "node:fs/promises";
import path from "node:path";
import { packageBin, projectRoot, runNode, timeoutMs } from "./portable-runtime.mjs";

const vinext = packageBin("vinext");
// A failed build must never be mistaken for a previously generated artifact.
await rm(path.join(projectRoot, "dist"), { recursive: true, force: true });
console.log("[sites] running bounded Vinext production build");
await runNode(vinext, ["build"], { timeout: timeoutMs(process.env.SITES_BUILD_TIMEOUT, 3 * 60_000) });
await runNode(path.join(projectRoot, "scripts/portable-validate-artifact.mjs"), [], { timeout: 30_000 });
