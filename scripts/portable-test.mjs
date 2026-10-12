import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot, runNode } from "./portable-runtime.mjs";

if (!process.argv.includes("--skip-build")) await runNode(path.join(projectRoot, "scripts/portable-build.mjs"));
const tests = (await readdir(path.join(projectRoot, "tests"))).filter((name) => name.endsWith(".test.mjs")).sort();
if (!tests.length) throw new Error("No Node tests were found");
await runNode("--import", [pathToFileURL(path.join(projectRoot, "scripts/portable-ts-register.mjs")).href, "--test", ...tests.map((name) => path.join(projectRoot, "tests", name))], { timeout: 5 * 60_000 });
