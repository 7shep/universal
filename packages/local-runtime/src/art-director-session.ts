// Turns a filesystem path into a live art director MCP session. This module knows
// nothing about operations, allowlists, or HTTP; ArtDirectorBridge owns all of that.
import { existsSync } from 'node:fs';
import path from 'node:path';

// Resolved by path rather than by module specifier: declaring design-mcp as a
// workspace dependency here would close a cycle, because design-mcp devDepends on
// this package and turbo builds its graph from dependencies AND devDependencies.
// This file lives at packages/local-runtime/src, so design-mcp is two levels up.
const DESIGN_MCP_DIR = path.resolve(import.meta.dirname, '..', '..', 'design-mcp');

/**
 * Locates design-mcp's built entry point. Returns undefined when the package is
 * present but unbuilt, which is the realistic failure in a fresh checkout.
 * `override` exists so the negative case is testable without deleting build output.
 *
 * The two undefined cases are deliberately not the same: a missing package
 * directory means the monorepo layout moved and is logged loudly, because a silent
 * undefined would start the CLI without an art director and skip the integration
 * tests. A missing dist/ is just an unbuilt package and stays quiet.
 */
export function resolveArtDirectorEntry(override?: string): string | undefined {
  if (override !== undefined) return existsSync(override) ? override : undefined;
  if (!existsSync(DESIGN_MCP_DIR)) {
    console.error(
      `Cannot locate the design-mcp package. Expected it at ${DESIGN_MCP_DIR}, resolved ` +
        'relative to @universal/local-runtime. The monorepo layout has changed; update ' +
        'DESIGN_MCP_DIR in packages/local-runtime/src/art-director-session.ts.'
    );
    return undefined;
  }
  const entry = path.join(DESIGN_MCP_DIR, 'dist', 'index.js');
  return existsSync(entry) ? entry : undefined;
}

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ArtDirectorMcpSession, ArtDirectorSessionFactory } from './art-director-bridge.ts';

export interface StdioArtDirectorOptions {
  entry: string;
  workspaceRoot: string;
  repositoryRoot: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class StdioArtDirectorSession implements ArtDirectorMcpSession {
  private readonly client: Client;
  constructor(client: Client) {
    this.client = client;
  }

  async call(tool: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    const result = await this.client.callTool({ name: tool, arguments: args }, undefined, {
      signal
    });
    const content = Array.isArray(result.content) ? result.content : [];
    const first = content[0];
    if (!isRecord(first) || first.type !== 'text' || typeof first.text !== 'string')
      throw new Error('Art director tool returned no text content.');
    let payload: unknown;
    try {
      payload = JSON.parse(first.text);
    } catch {
      throw new Error('Art director tool returned malformed JSON.');
    }
    // The code is placed first in the message so ArtDirectorBridge.isTransportFailure
    // can match it and avoid retrying a domain error against a fresh child. That regex
    // currently recognises only INVALID_SESSION and ILLEGAL_TRANSITION; design-mcp's
    // other codes (BRIEF_NOT_READY, BRIEF_NOT_APPROVED, STALE_CONCEPTS,
    // STALE_SELECTED_DIRECTION, SERVICE_OUTPUT_INVALID, REQUEST_ID_CONFLICT) are still
    // treated as transport failures and retried.
    if (result.isError === true) {
      const detail = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
      const code = typeof detail?.code === 'string' ? detail.code : 'ART_DIRECTOR_FAILURE';
      const message = typeof detail?.message === 'string' ? detail.message : first.text;
      throw new Error(`${code}: ${message}`);
    }
    return payload;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * Each call spawns a fresh `node <entry>` child over stdio. The bridge creates a
 * session lazily and drops it on transport failure, so this factory may be called
 * again at any time.
 */
export function createStdioArtDirectorSessionFactory(
  options: StdioArtDirectorOptions
): ArtDirectorSessionFactory {
  return async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [options.entry],
      cwd: options.repositoryRoot,
      env: {
        ...getDefaultEnvironment(),
        UNIVERSAL_WORKSPACE_ROOT: options.workspaceRoot,
        UNIVERSAL_REPOSITORY_ROOT: options.repositoryRoot
      }
    });
    const client = new Client({ name: 'universal-local-runtime', version: '0.1.0' });
    await client.connect(transport);
    return new StdioArtDirectorSession(client);
  };
}
