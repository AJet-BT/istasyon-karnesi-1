import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { npmCli, projectRoot, runNode, runtimeEnv, runtimeRoot, timeoutMs, packageBin } from "./portable-runtime.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const inputPaths = ["package.json", "package-lock.json", ".npmrc"];
const inputHashes = new Map(await Promise.all(inputPaths.map(async (name) => [name, sha256(await readFile(path.join(projectRoot, name)))])));
const env = await runtimeEnv();
const lockDirectory = path.join(runtimeRoot, "install.lock.d");
await mkdir(lockDirectory).catch(() => { throw new Error("Another install is running, or an interrupted install left .sites-runtime/install.lock.d. Check its owner.json before removing the stale lock."); });
await writeFile(path.join(lockDirectory, "owner.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
try {
  const npm = npmCli();
  const lock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
  const vinext = lock.packages?.["node_modules/vinext"];
  if (!vinext?.resolved || !vinext?.integrity) throw new Error("Vinext must have a resolved, integrity-pinned lockfile entry.");
  let seeded = false;
  let cacheSeed = "seed_unavailable";
  if (process.env.SITES_NPM_CACHE_SEED) {
    const seed = path.resolve(process.env.SITES_NPM_CACHE_SEED);
    const marker = await readFile(path.join(seed, ".sites-lockfile-sha256"), "utf8").catch(() => "");
    if (marker.trim() === inputHashes.get("package-lock.json")) {
      await cp(seed, env.npm_config_cache, { recursive: true });
      seeded = true;
      cacheSeed = "seed_used";
    } else cacheSeed = "seed_lockfile_mismatch";
  }
  if (process.env.SITES_INSTALL_REPORT_PATH) {
    await writeFile(process.env.SITES_INSTALL_REPORT_PATH, JSON.stringify({ version: 1, cache_seed: cacheSeed, store_scope: "project", store_state: seeded ? "seeded" : "created" }));
  }
  if (!seeded) {
    console.log("[sites] downloading and verifying the locked Vinext tarball");
    const { stdout } = await runNode(npm, ["config", "get", "registry"], { env, capture: true, timeout: 15_000 });
    const tarballUrl = new URL(vinext.resolved);
    const registry = new URL(stdout.trim());
    if (tarballUrl.hostname === "registry.npmjs.org") {
      tarballUrl.protocol = registry.protocol;
      tarballUrl.host = registry.host;
      tarballUrl.pathname = `${registry.pathname.replace(/\/$/, "")}${tarballUrl.pathname}`;
    }
    const response = await fetch(tarballUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Locked tarball preflight failed (HTTP ${response.status})`);
    const tarball = Buffer.from(await response.arrayBuffer());
    const integrityMatches = vinext.integrity.split(/\s+/).some((entry) => {
      const separator = entry.indexOf("-");
      return createHash(entry.slice(0, separator)).update(tarball).digest("base64") === entry.slice(separator + 1);
    });
    if (!integrityMatches) throw new Error("Locked Vinext tarball integrity mismatch");
  }
  console.log("[sites] running one bounded npm ci");
  await runNode(npm, ["ci", "--cache", env.npm_config_cache, ...(seeded ? ["--prefer-offline"] : [])], {
    env: { ...env, npm_config_maxsockets: "1", npm_config_fetch_retries: "0", npm_config_fetch_timeout: "30000" },
    timeout: timeoutMs(process.env.SITES_INSTALL_TIMEOUT, 8 * 60_000),
  });
  for (const [name, expected] of inputHashes) {
    if (sha256(await readFile(path.join(projectRoot, name))) !== expected) throw new Error(`Dependency input changed during installation: ${name}`);
  }
  packageBin("vinext");
  await writeFile(path.join(projectRoot, "node_modules/.sites-install.json"), `${JSON.stringify({ lockfile_sha256: inputHashes.get("package-lock.json"), node: process.version, platform: `${process.platform}-${process.arch}` }, null, 2)}\n`);
  console.log("[sites] npm ci passed; locked inputs are unchanged and Vinext is available");
} finally {
  await rm(lockDirectory, { recursive: true, force: true });
}
