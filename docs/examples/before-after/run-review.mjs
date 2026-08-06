#!/usr/bin/env node
// Runs the same `review_implementation` logic the Universal MCP server exposes
// (packages/design-mcp/src/index.ts calls `reviewImplementation` from
// @universal/design-linter directly) against the before/ and after/ example
// apps in this directory, and prints the real JSON output for each.
//
// Usage (from a repository checkout, no build step required -- the workspace
// packages ship TypeScript source and Node's type-stripping loader runs it
// directly):
//
//   node --experimental-strip-types docs/examples/before-after/run-review.mjs
//
// This is how the numbers in docs/EXAMPLES.md were captured. Re-run this
// script and paste its output back into that doc if the example apps or the
// design-linter rules change.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewImplementation } from '../../../packages/design-linter/src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadExample(name) {
  const dir = path.join(here, name);
  const [appTsx, stylesCss] = await Promise.all([
    readFile(path.join(dir, 'App.tsx'), 'utf8'),
    readFile(path.join(dir, 'styles.css'), 'utf8')
  ]);
  return [
    { path: 'src/App.tsx', content: appTsx },
    { path: 'src/styles.css', content: stylesCss }
  ];
}

for (const name of ['before', 'after']) {
  const files = await loadExample(name);
  const result = reviewImplementation(files);
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(result, null, 2));
}
