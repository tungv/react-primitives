// Publishes every package whose version is not on npm yet, dependencies first. `bun publish` replaces
// the `workspace:^` ranges between them with the versions being published; `npm publish` would not.
// Pass --dry-run to see what would go out.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORDER = ["react-slot", "react-hover-highlight", "react-grid-list"];
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
