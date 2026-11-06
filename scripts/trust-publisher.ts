// Makes .github/workflows/release.yml the trusted publisher of every package, so the Release workflow can
// publish them with OIDC and no npm token. Run once, after the first release, from a terminal: npm asks for
// your two-factor code, and each package must already exist on npm. Needs npm 11.15 or later.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const REPOSITORY = "tungv/react-primitives";
const WORKFLOW = "release.yml";
const PACKAGES = [
  "react-slot",
  "react-reducer-context",
  "react-reserve-layout",
  "react-hover-highlight",
  "react-grid-list",
  "react-form",
  "next-interactive-form",
  "next-navigation-form",
];

for (const [index, dir] of PACKAGES.entries()) {
  const { name } = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) as { name: string };
  console.log(`Trusting ${REPOSITORY}/.github/workflows/${WORKFLOW} to publish ${name}`);
  const result = Bun.spawnSync(
    ["npm", "trust", "github", name, "--repo", REPOSITORY, "--file", WORKFLOW, "--allow-publish", "--yes"],
    { stdout: "inherit", stderr: "inherit", stdin: "inherit" },
  );
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
  // npm asks for a pause between trust calls.
  if (index < PACKAGES.length - 1) await Bun.sleep(2000);
}
