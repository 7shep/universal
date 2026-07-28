#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
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
const server = new RuntimeHttpServer({ service, allowedOrigins: [studioOrigin, previewOrigin] });
await server.start();
process.stdout.write(
  `${JSON.stringify({ runtimeOrigin: server.origin, bootstrapToken: server.bootstrapSecret, workspaceRoot, provider: configured.providerId })}\n`
);
const shutdown = async () => {
  await server.close();
  await service.shutdown();
  process.exit(0);
};
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
