import { packageBin, runNode } from "./portable-runtime.mjs";

const commands = {
  dev: ["vite", "vite", []],
  start: ["vinext", "vinext", ["start"]],
  lint: ["eslint", "eslint", [".", "--ignore-pattern", "dist", "--ignore-pattern", ".next"]],
  typecheck: ["typescript", "tsc", ["--noEmit"]],
  "db:generate": ["drizzle-kit", "drizzle-kit", ["generate"]],
};
const command = commands[process.argv[2]];
if (!command) throw new Error("Unknown portable command");
await runNode(packageBin(command[0], command[1]), [...command[2], ...process.argv.slice(3)]);
