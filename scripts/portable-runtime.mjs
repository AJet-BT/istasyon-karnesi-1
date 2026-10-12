import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const runtimeRoot = path.resolve(process.env.SITES_RUNTIME_ROOT || path.join(projectRoot, ".sites-runtime"));

export async function runtimeEnv() {
  const directories = ["npm-cache", "tmp", "xdg-config", "wrangler/logs", "wrangler/registry"];
  await Promise.all(directories.map((directory) => mkdir(path.join(runtimeRoot, directory), { recursive: true })));
  const env = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ""}`,
    SITES_PROJECT_ROOT: projectRoot,
    SITES_RUNTIME_ROOT: runtimeRoot,
    XDG_CONFIG_HOME: path.join(runtimeRoot, "xdg-config"),
    TMPDIR: path.join(runtimeRoot, "tmp"),
    TEMP: path.join(runtimeRoot, "tmp"),
    TMP: path.join(runtimeRoot, "tmp"),
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: path.join(runtimeRoot, "wrangler", "logs"),
    MINIFLARE_REGISTRY_PATH: path.join(runtimeRoot, "wrangler", "registry"),
    npm_config_cache: path.join(runtimeRoot, "npm-cache"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
  for (const key of Object.keys(env)) {
    if (/^npm_config_(cache|proxy|http_proxy|https_proxy)$/i.test(key) && key !== "npm_config_cache") delete env[key];
  }
  return env;
}

export function timeoutMs(value, fallback) {
  if (!value) return fallback;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(value);
  if (!match) throw new Error(`Invalid timeout: ${value}`);
  const result = Number(match[1]) * ({ ms: 1, s: 1000, m: 60_000 }[match[2] || "s"]);
  if (!Number.isFinite(result) || result <= 0) throw new Error("Timeout must be positive");
  return result;
}

export function packageBin(name, bin = name) {
  const packageDirectory = path.join(projectRoot, "node_modules", name);
  const manifest = JSON.parse(readFileSync(path.join(packageDirectory, "package.json"), "utf8"));
  const target = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
  if (!target) throw new Error(`Missing ${name} executable. Run npm run install:ci first.`);
  const executable = path.resolve(packageDirectory, target);
  if (!existsSync(executable)) throw new Error(`Missing ${name} executable. Run npm run install:ci first.`);
  return executable;
}

export function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    process.env.SITES_NPM_CLI,
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    ...((process.env.PATH || "").split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, "node_modules/npm/bin/npm-cli.js"))),
  ];
  const cli = candidates.find((candidate) => candidate && /npm-cli\.(?:js|cjs)$/.test(candidate) && existsSync(candidate));
  if (!cli) throw new Error("npm CLI unavailable. Run this script through npm or set SITES_NPM_CLI to npm-cli.js.");
  return cli;
}

// No shell is involved: JavaScript CLIs use the exact Node executable that
// started this script, including paths with spaces on Windows.
export async function runNode(script, args = [], options = {}) {
  const env = options.env || await runtimeEnv();
  const timeout = options.timeout || 0;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: projectRoot, env, stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancellation;
    let forceTimer;
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
        killer.on("error", () => child.kill());
        killer.on("close", (code) => { if (code !== 0) child.kill(); });
        // Restricted Windows sessions can start taskkill yet deny its process
        // inspection. Enforce the deadline for the direct child in that case.
        forceTimer = setTimeout(() => child.kill(), 1000);
        forceTimer.unref();
      } else {
        try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
        forceTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 10_000);
        forceTimer.unref();
      }
    };
    const timer = timeout ? setTimeout(() => { timedOut = true; stop(); }, timeout) : undefined;
    const interrupt = () => { cancellation = "SIGINT"; stop(); };
    const terminate = () => { cancellation = "SIGTERM"; stop(); };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    const cleanup = () => {
      clearTimeout(timer); clearTimeout(forceTimer);
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
    };
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("close", (code, signal) => {
      cleanup();
      if (timedOut) reject(new Error(`Command timed out after ${timeout}ms: ${path.basename(script)}`));
      else if (cancellation) reject(new Error(`Command cancelled (${cancellation}): ${path.basename(script)}`));
      else if (code !== 0) reject(new Error(`Command failed (${code ?? signal}): ${path.basename(script)}${stderr ? `\n${stderr}` : ""}`));
      else resolve({ stdout, stderr });
    });
  });
}
