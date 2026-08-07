// Verifies the published MCP server's version is not duplicated-and-drifted.
//
// packages/design-mcp/package.json is the single source of truth for the
// version. Everything else that names a version must match it exactly:
//
//   - server.json's top-level `version`
//   - server.json's `packages[].version` for the npm package entry
//
// (The MCP handshake version reported by src/index.ts is derived directly
// from package.json at build time via a JSON import — see src/index.ts and
// scripts/bundle.mjs — so there is nothing to check there; it cannot drift.)
//
// This script would have caught the exact bug reported in issue #144, where
// server.json and the runtime handshake version disagreed with package.json.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const packageDir = path.join(repoRoot, 'packages', 'design-mcp');

function readJson(relativePath) {
  const filePath = path.join(packageDir, relativePath);
  return { filePath, data: JSON.parse(readFileSync(filePath, 'utf8')) };
}

const { filePath: packageJsonPath, data: packageJson } = readJson('package.json');
const { filePath: serverJsonPath, data: serverJson } = readJson('server.json');

const sourceOfTruth = packageJson.version;
if (typeof sourceOfTruth !== 'string' || sourceOfTruth.length === 0) {
  console.error(`[check-mcp-version] ${packageJsonPath} has no "version" string`);
  process.exit(1);
}

const errors = [];

if (serverJson.version !== sourceOfTruth) {
  errors.push(
    `${serverJsonPath}: top-level "version" is ${JSON.stringify(serverJson.version)}, expected ${JSON.stringify(sourceOfTruth)} (from package.json)`
  );
}

const npmPackageEntries = (serverJson.packages ?? []).filter(
  (entry) => entry.identifier === packageJson.name
);
if (npmPackageEntries.length === 0) {
  errors.push(
    `${serverJsonPath}: no packages[] entry with identifier ${JSON.stringify(packageJson.name)}`
  );
}
for (const entry of npmPackageEntries) {
  if (entry.version !== sourceOfTruth) {
    errors.push(
      `${serverJsonPath}: packages[] entry ${JSON.stringify(entry.identifier)} has "version" ${JSON.stringify(entry.version)}, expected ${JSON.stringify(sourceOfTruth)} (from package.json)`
    );
  }
}

if (errors.length > 0) {
  console.error(`[check-mcp-version] ${errors.length} issue(s) found:\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error(
    `\npackages/design-mcp/package.json's "version" (${JSON.stringify(sourceOfTruth)}) is the single source of truth. Update server.json to match.`
  );
  process.exitCode = 1;
} else {
  console.log(
    `[check-mcp-version] OK — server.json matches package.json's version (${sourceOfTruth})`
  );
}
