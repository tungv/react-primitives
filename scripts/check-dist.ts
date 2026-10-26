// Checks each built package as a consumer meets it: client modules keep their "use client" directive
// (React Server Components bundlers read it from the file's first statement), every export in its
// package.json resolves to a file, its packed manifest names real versions instead of `workspace:`
// ranges, and its entry point loads under plain Node ESM.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

/** Each package, and the modules in it that must stay client modules. */
const PACKAGES: Record<string, string[]> = {
  slot: [],
  "hover-highlight": ["index"],
  "grid-list": ["components", "hooks", "state", "reducer-context", "pile"],
};

const failures: string[] = [];

for (const [name, clientModules] of Object.entries(PACKAGES)) {
  const dir = join(root, "packages", name);

  for (const module of clientModules) {
    const file = join(dir, "dist", `${module}.js`);
    const source = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!source.startsWith('"use client";')) failures.push(`${name}: dist/${module}.js does not start with "use client"`);
  }

  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    exports: Record<string, string | Record<string, string>>;
  };
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    for (const file of typeof target === "string" ? [target] : Object.values(target)) {
      if (!existsSync(join(dir, file))) failures.push(`${name}: export "${subpath}" points at missing ${file}`);
    }
  }

  // `bun pm pack` rewrites `workspace:` ranges the way `bun publish` does; read back what it wrote.
  const out = mkdtempSync(join(tmpdir(), `pack-${name}-`));
  const pack = Bun.spawnSync(["bun", "pm", "pack", "--destination", out, "--ignore-scripts", "--quiet"], {
    cwd: dir,
    stderr: "pipe",
  });
  const tarball = readdirSync(out).find((file) => file.endsWith(".tgz"));
  const packedManifest = tarball
    ? Bun.spawnSync(["tar", "-xOf", join(out, tarball), "package/package.json"]).stdout.toString()
    : "";
  if (pack.exitCode !== 0 || !packedManifest) failures.push(`${name}: could not pack (${pack.stderr.toString().trim()})`);
  else if (packedManifest.includes("workspace:")) failures.push(`${name}: packed package.json still has a workspace: range`);
  rmSync(out, { recursive: true, force: true });

  const node = Bun.spawnSync(
    ["node", "--input-type=module", "-e", `const m = await import("@tungv/${name}"); if (Object.keys(m).length === 0) process.exit(1);`],
    { cwd: dir, stderr: "pipe" },
  );
  if (node.exitCode !== 0) failures.push(`${name}: Node could not import it: ${node.stderr.toString().trim()}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`dist ok: ${Object.keys(PACKAGES).join(", ")}`);
