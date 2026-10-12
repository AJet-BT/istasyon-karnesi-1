import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./portable-runtime.mjs";

const packagedManifest = JSON.parse(await readFile(path.join(projectRoot, "dist/.openai/hosting.json"), "utf8"));
const sourceManifest = JSON.parse(await readFile(path.join(projectRoot, ".openai/hosting.json"), "utf8"));
assert.deepEqual(packagedManifest, sourceManifest, "Packaged Sites manifest must match its source");
assert.ok(packagedManifest.project_id, "Packaged Sites manifest must retain its Site identity");
const clientAssets = await readdir(path.join(projectRoot, "dist/client/assets"));
assert.ok(clientAssets.some((name) => name.endsWith(".js")), "Production client JavaScript is missing");
const workerUrl = pathToFileURL(path.join(projectRoot, "dist/server/index.js"));
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
assert.equal(typeof worker.default?.fetch, "function", "Sites Worker must export default.fetch(request, env, ctx)");
console.log("[sites] verified built Worker default.fetch, client assets, and matching hosting manifest");
