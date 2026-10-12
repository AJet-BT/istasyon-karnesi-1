import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  // Next's published Node entry points are .js files; application bundlers
  // accept the extensionless names used by the source modules.
  if (["next/headers", "next/navigation", "next/server"].includes(specifier)) return nextResolve(`${specifier}.js`, context);
  const alias = specifier.startsWith("@/");
  const local = alias || specifier.startsWith("./") || specifier.startsWith("../");
  if (!local) return nextResolve(specifier, context);
  const target = alias ? pathToFileURL(path.join(sourceRoot, specifier.slice(2))) : new URL(specifier, context.parentURL);
  try { return await nextResolve(target.href, context); } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" && error.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw error;
    for (const suffix of [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.mjs", "/index.js"]) {
      const candidate = `${target.href}${suffix}`;
      try { await access(fileURLToPath(candidate)); return { url: candidate, shortCircuit: true }; } catch {}
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !/\.(?:ts|tsx|mts)(?:\?|$)/.test(url) || url.includes("/node_modules/")) return nextLoad(url, context);
  const fileName = fileURLToPath(url);
  const source = await readFile(fileName, "utf8");
  const result = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  const errors = result.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) || [];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => sourceRoot, getCanonicalFileName: (name) => name, getNewLine: () => "\n" }));
  return { format: "module", source: result.outputText, shortCircuit: true };
}
