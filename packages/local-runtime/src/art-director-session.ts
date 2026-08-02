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

  async call(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<unknown> {
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
    // The code must appear in the message: ArtDirectorBridge.isTransportFailure keys off
    // INVALID_SESSION / ILLEGAL_TRANSITION / IDEMPOTENCY to avoid retrying a session
    // error against a fresh child, which would only fail the same way.
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
      },
      stderr: 'pipe'
    });
    const client = new Client({ name: 'universal-local-runtime', version: '0.1.0' });
    await client.connect(transport);
    return new StdioArtDirectorSession(client);
  };
}
