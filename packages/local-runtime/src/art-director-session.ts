// Turns a filesystem path into a live art director MCP session. This module knows
// nothing about operations, allowlists, or HTTP; ArtDirectorBridge owns all of that.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PACKAGE = '@7shep/universal-mcp';

/**
 * Locates design-mcp's built entry point. Returns undefined when the package is
 * present but unbuilt, which is the realistic failure in a fresh checkout.
 * `override` exists so the negative case is testable without deleting build output.
 */
export function resolveArtDirectorEntry(override?: string): string | undefined {
  if (override !== undefined) return existsSync(override) ? override : undefined;
  try {
    const manifest = createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`);
    const entry = path.join(path.dirname(manifest), 'dist', 'index.js');
    return existsSync(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}
