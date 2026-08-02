#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { ArtDirectorBridge } from './art-director-bridge.ts';
import {
  createStdioArtDirectorSessionFactory,
  resolveArtDirectorEntry
} from './art-director-session.ts';
import { RuntimeHttpServer } from './http-server.ts';
import { RuntimeService } from './runtime-service.ts';
import { createConfiguredGenerator } from './provider-config.ts';

const workspaceRoot =
  process.env.UNIVERSAL_WORKSPACE_ROOT ?? path.join(os.homedir(), '.universal', 'workspaces');
const studioOrigin = process.env.UNIVERSAL_STUDIO_ORIGIN ?? 'http://127.0.0.1:5173';
const previewOrigin = process.env.UNIVERSAL_PREVIEW_ORIGIN ?? 'http://127.0.0.1:5174';
const configured = createConfiguredGenerator(process.env);
const service = new RuntimeService({
  workspaceRoot,
  repositoryRoot: process.cwd(),
  generator: configured.generator
});
await service.initialize();
const artDirectorEntry = resolveArtDirectorEntry();
const artDirector = artDirectorEntry
  ? new ArtDirectorBridge({
      createSession: createStdioArtDirectorSessionFactory({
        entry: artDirectorEntry,
        workspaceRoot,
        repositoryRoot: process.cwd()
      })
    })
  : undefined;
const server = new RuntimeHttpServer({
  service,
  allowedOrigins: [studioOrigin, previewOrigin],
  ...(artDirector ? { artDirector } : {})
});
await server.start();
process.stdout.write(
  `${JSON.stringify({ runtimeOrigin: server.origin, bootstrapToken: server.bootstrapSecret, workspaceRoot, provider: configured.providerId, artDirector: artDirector !== undefined })}\n`
);
const shutdown = async () => {
  await server.close();
  if (artDirector) await artDirector.close();
  await service.shutdown();
  process.exit(0);
};
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
