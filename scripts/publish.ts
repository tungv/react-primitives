// The first release, from a maintainer's machine: publishes every package whose version is not on npm yet,
// dependencies first. npm only lets a package that exists name a trusted publisher, so this runs once; after
// `bun run release:trust`, the Release workflow publishes everything. Pass --dry-run to see what would go out.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORDER = [
  "react-slot",
  "react-reducer-context",
  "react-reserve-layout",
  "react-hover-highlight",
  "react-grid-list",
  "react-form",
  "next-interactive-form",
  "next-navigation-form",
];
const dryRun = process.argv.includes("--dry-run");
const root = join(import.meta.dir, "..");

for (const name of ORDER) {
  const dir = join(root, "packages", name);
  const { name: id, version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string; version: string };
  const published = Bun.spawnSync(["npm", "view", `${id}@${version}`, "version"], { stderr: "pipe" }).stdout.toString().trim();
  if (published === version) {
    console.log(`${id}@${version} is already on npm`);
    continue;
  }
  console.log(`${dryRun ? "Would publish" : "Publishing"} ${id}@${version}`);
  const result = Bun.spawnSync(["bun", "publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])], {
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}
