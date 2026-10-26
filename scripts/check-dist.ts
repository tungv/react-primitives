// Checks the built package as a consumer meets it: every client module keeps its "use client"
// directive (React Server Components bundlers read it from the file's first statement), every export
// in package.json resolves to a file, and the entry point loads under plain Node ESM.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const failures: string[] = [];

const clientModules = ["components", "hooks", "state", "reducer-context", "slot", "hover-highlight"];
for (const name of clientModules) {
  const file = join(root, "dist", `${name}.js`);
  const source = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (!source.startsWith('"use client";')) failures.push(`dist/${name}.js does not start with "use client"`);
}

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string | Record<string, string>>;
};
for (const [subpath, target] of Object.entries(manifest.exports)) {
  for (const file of typeof target === "string" ? [target] : Object.values(target)) {
    if (!existsSync(join(root, file))) failures.push(`export "${subpath}" points at missing ${file}`);
  }
}

const node = Bun.spawnSync(
  ["node", "--input-type=module", "-e", 'const m = await import("@tungv/grid-list"); if (typeof m.GridListContainer !== "function") process.exit(1);'],
  { cwd: root, stderr: "pipe" },
);
if (node.exitCode !== 0) failures.push(`Node could not import the package: ${node.stderr.toString().trim()}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("dist ok");
