import path from "node:path";
import { projectRoot, runNode } from "./portable-runtime.mjs";

console.log("[quality gate] lint");
await runNode(path.join(projectRoot, "scripts/portable-command.mjs"), ["lint"], { timeout: 3 * 60_000 });
console.log("[quality gate] TypeScript typecheck");
await runNode(path.join(projectRoot, "scripts/portable-command.mjs"), ["typecheck"], { timeout: 3 * 60_000 });
console.log("[quality gate] production build and built artifact validation");
await runNode(path.join(projectRoot, "scripts/portable-build.mjs"));
console.log("[quality gate] complete Node test suite");
await runNode(path.join(projectRoot, "scripts/portable-test.mjs"), ["--skip-build"]);
console.log("[quality gate] automated checks passed. Browser interactions and PDF exports from the running application require separate browser verification; sample PDFs are not application evidence.");
