import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateDesignPlanV2, type DesignPlanV2 } from '@universal/design-engine';
import {
  GENERATION_CONTRACT_VERSION,
  ReactGenerator,
  createGenerationContext,
  createProjectGenerationRequest,
  digestValue,
  redactSecrets,
  type ProjectFileKind,
  type RawGeneratedProject,
  type ReactGenerationProvider
} from '@universal/generation';
import { RuntimeFailure, RuntimeService } from '@universal/local-runtime';
import {
  ArtDirectorError,
  parseArtDirectorSession,
  type ArtDirectorSession
} from './art-director.js';

const defaultRepositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const MAX_FILE_CHARACTERS = 256 * 1024;
const MAX_ASSET_CHARACTERS = 384 * 1024;

export interface SubmittedProjectFile {
  path: string;
  content: string;
  kind: ProjectFileKind;
}

export interface SubmittedProjectAsset {
  path: string;
  mediaType: string;
  encoding: 'base64';
  content: string;
}

export interface BuildReactProjectInput {
  session: string;
  requestId: string;
  files: readonly SubmittedProjectFile[];
  assets?: readonly SubmittedProjectAsset[] | undefined;
}

export interface RuntimeBuildMcpAdapterOptions {
  workspaceRoot?: string | undefined;
  repositoryRoot?: string | undefined;
  now?: (() => string) | undefined;
  createId?: (() => string) | undefined;
}

export interface RuntimeBuildMcpAdapter {
  prepare(session: string): Promise<unknown>;
  build(input: BuildReactProjectInput): Promise<RuntimeBuildResult>;
}

export type RuntimeBuildResult =
  | {
      ok: true;
      replayed: boolean;
      projectId: string;
      revisionId: string;
      operationId: string;
      buildId: string;
      workspacePath: string;
      outputPath: string;
      diagnostics: readonly unknown[];
      review: unknown;
      localDevelopment: {
        cwd: string;
        command: 'pnpm';
        args: readonly ['run', 'dev'];
        host: '127.0.0.1';
        note: string;
      };
    }
  | {
      ok: false;
      replayed: boolean;
      projectId: string;
      revisionId: string;
      operationId: string;
      buildId?: string | undefined;
      workspacePath?: string | undefined;
      diagnostics: readonly unknown[];
      review?: unknown;
      error: unknown;
    };

function resolvePlan(serializedSession: string): {
  session: ArtDirectorSession;
  plan: DesignPlanV2;
} {
  const session = parseArtDirectorSession(serializedSession);
  if (session.phase !== 'plan-created' || !session.designPlan || session.designPlan.stale) {
    throw new ArtDirectorError(
      'ILLEGAL_TRANSITION',
      'React generation requires a current Design Plan v2.',
      'Complete discovery, approve the brief, select a direction, and call create_design_plan_v2.'
    );
  }
  const checked = validateDesignPlanV2(session.designPlan.plan);
  if (!checked.ok) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Design Plan v2 is invalid at ${checked.error.path}: ${checked.error.message}`,
      'Restore the exact plan-created session returned by create_design_plan_v2.'
    );
  }
  return { session, plan: checked.value };
}

function projectIdFor(plan: DesignPlanV2): string {
  return `mcp-project:${plan.digest.slice(0, 24)}`;
}

function architecturePolicyFor(plan: DesignPlanV2) {
  const pages = plan.pageMap.pages,
    multiRoute = plan.pageMap.kind === 'multi-page' || pages.length > 1,
    requiredSections = pages.reduce((total, page) => total + page.requiredSections.length, 0),
    sharedElements = [...new Set(pages.flatMap((page) => page.sharedElements))],
    complexity = multiRoute
      ? ('multi-route' as const)
      : requiredSections >= 4
        ? ('substantial-single-page' as const)
        : ('small' as const);
  return {
    policyVersion: '1.0.0',
    complexity,
    approvedRoutes: pages.map((page) => page.route),
    requiredSectionCount: requiredSections,
    planDeclaredSharedElements: sharedElements,
    expectations: [
      ...(multiRoute
        ? [
            'Create an identifiable page component module outside App.tsx for every approved route.',
            'Keep App.tsx focused on route selection and top-level composition.',
            'Do not place multiple complete page implementations in one source module.'
          ]
        : requiredSections >= 4
          ? [
              'Compose substantial required sections from cohesive section or feature modules outside App.tsx.'
            ]
          : [
              'Keep small static leaf content local when extraction would add no meaningful boundary.'
            ]),
      ...(sharedElements.length > 0
        ? [
            `Extract reusable plan-declared interface regions where they repeat: ${sharedElements.join(', ')}.`
          ]
        : []),
      'Give configurable exported or reused components explicit TypeScript props types.',
      'Move substantial content collections into data modules when they are not rendering logic.',
      'Avoid substantial copy-pasted JSX; extract a cohesive shared component instead.',
      'For visually substantial work, organize tokens/shared/page styles behind src/styles.css without requiring one file per component.',
      'Do not create meaningless one-line wrappers merely to increase component or file counts.'
    ],
    exampleOnly:
      'A nontrivial site commonly uses src/pages, src/components, src/data, and src/styles modules, but filenames and folders are judged by responsibilities rather than preference.'
  };
}
function normalizeSubmission(input: BuildReactProjectInput): RawGeneratedProject {
  return {
    files: [...input.files]
      .map((file) => ({ path: file.path, content: file.content, kind: file.kind }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    assets: [...(input.assets ?? [])]
      .map((asset) => ({
        path: asset.path,
        mediaType: asset.mediaType,
        encoding: asset.encoding,
        content: asset.content
      }))
      .sort((left, right) => left.path.localeCompare(right.path))
  };
}

class SubmittedProjectProvider implements ReactGenerationProvider {
  readonly capabilities = {
    providerId: 'mcp-host-model',
    contractVersions: [GENERATION_CONTRACT_VERSION],
    structuredOutput: true,
    deterministic: true,
    requiresCredentials: false
  } as const;

  constructor(private readonly project: RawGeneratedProject) {}

  async generate(_request: unknown, signal?: AbortSignal): Promise<RawGeneratedProject> {
    if (signal?.aborted) throw new Error('Submitted project generation was cancelled.');
    return this.project;
  }
}

function cleanDiagnostics<T extends { output?: string | undefined }>(
  diagnostics: readonly T[]
): readonly T[] {
  return diagnostics.map((diagnostic) =>
    diagnostic.output ? { ...diagnostic, output: redactSecrets(diagnostic.output) } : diagnostic
  );
}

export function createRuntimeBuildMcpAdapter(
  options: RuntimeBuildMcpAdapterOptions = {}
): RuntimeBuildMcpAdapter {
  const configuredWorkspaceRoot = process.env.UNIVERSAL_WORKSPACE_ROOT?.trim(),
    workspaceRoot =
      options.workspaceRoot ??
      (configuredWorkspaceRoot || path.join(os.homedir(), '.universal', 'workspaces')),
    repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  let queue: Promise<void> = Promise.resolve();

  const exclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return {
    async prepare(serializedSession) {
      const { session, plan } = resolvePlan(serializedSession);
      return {
        contractVersion: GENERATION_CONTRACT_VERSION,
        sessionId: session.id,
        projectId: projectIdFor(plan),
        designPlan: {
          id: plan.id,
          digest: plan.digest,
          contractVersion: plan.contractVersion
        },
        context: createGenerationContext(plan),
        sourceContract: {
          framework: 'react-vite',
          requiredFiles: ['src/App.tsx', 'src/styles.css'],
          allowedTextPaths: 'src/**/*.{ts,tsx,css,txt}',
          runtimeOwnedFiles: [
            'src/main.tsx',
            'package.json',
            'pnpm-lock.yaml',
            'pnpm-workspace.yaml',
            'vite.config.ts',
            'tsconfig.json',
            'tsconfig.app.json',
            'tsconfig.node.json',
            'index.html'
          ],
          maximumFiles: 64,
          maximumAssets: 16,
          maximumFileBytes: 256 * 1024,
          maximumTotalBytes: 2 * 1024 * 1024,
          assetMediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
          architecturePolicy: architecturePolicyFor(plan)
        },
        next: {
          tool: 'build_react_project',
          instructions: [
            'Generate complete source files from this exact Design Plan v2 context.',
            'Do not emit runtime-owned files, dependencies, configuration, or commands.',
            'Include every approved route literally in source and preserve page responsibilities.',
            'Follow sourceContract.architecturePolicy; architecture errors fail deterministic review and warnings remain in diagnostics.',
            'Include semantic nav/main/h1 landmarks, :focus-visible, and prefers-reduced-motion.',
            'Use a new stable requestId when intentionally retrying a failed build.'
          ]
        }
      };
    },

    async build(input) {
      return exclusive(async () => {
        const { plan } = resolvePlan(input.session),
          rawProject = normalizeSubmission(input),
          projectId = projectIdFor(plan),
          revisionId = `mcp-revision:${digestValue({
            requestId: input.requestId,
            project: rawProject
          }).slice(0, 24)}`,
          request = createProjectGenerationRequest({ projectId, revisionId, designPlan: plan }),
          service = new RuntimeService({
            workspaceRoot,
            repositoryRoot,
            generator: new ReactGenerator(new SubmittedProjectProvider(rawProject)),
            ...(options.now ? { now: options.now } : {}),
            ...(options.createId ? { createId: options.createId } : {})
          });
        await service.initialize();
        try {
          const accepted = await service.startGeneration(
              request,
              `mcp-build:${plan.digest}:${input.requestId}`
            ),
            operation = await service.waitForOperation(accepted.operation.id),
            state = service.state(),
            revision = state.revisions.find((item) => item.id === revisionId),
            build = operation.buildId
              ? state.builds.find((item) => item.id === operation.buildId)
              : undefined,
            diagnostics = cleanDiagnostics(build?.diagnostics ?? []);
          if (
            operation.status !== 'ready' ||
            !operation.buildId ||
            !revision ||
            !build?.outputPath
          ) {
            return {
              ok: false,
              replayed: accepted.replayed,
              projectId,
              revisionId,
              operationId: operation.id,
              ...(operation.buildId ? { buildId: operation.buildId } : {}),
              ...(revision ? { workspacePath: revision.workspacePath } : {}),
              diagnostics,
              ...(build?.review ? { review: build.review } : {}),
              error:
                operation.error ??
                ({
                  code: 'INTERNAL_FAILURE',
                  message: 'Build did not produce a ready immutable revision.',
                  retryable: false
                } as const)
            };
          }
          return {
            ok: true,
            replayed: accepted.replayed,
            projectId,
            revisionId,
            operationId: operation.id,
            buildId: operation.buildId,
            workspacePath: revision.workspacePath,
            outputPath: build.outputPath,
            diagnostics,
            review: build.review,
            localDevelopment: {
              cwd: revision.workspacePath,
              command: 'pnpm',
              args: ['run', 'dev'],
              host: '127.0.0.1',
              note: 'Run the command from cwd; Vite will print the selected loopback URL.'
            }
          };
        } finally {
          await service.shutdown();
        }
      });
    }
  };
}

function toolResult(value: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {})
  };
}

function errorPayload(error: unknown): unknown {
  if (error instanceof ArtDirectorError) return error.toJSON();
  if (error instanceof RuntimeFailure)
    return { ...error.detail, message: redactSecrets(error.detail.message) };
  return {
    code: 'RUNTIME_BUILD_FAILURE',
    message: redactSecrets(error instanceof Error ? error.message : String(error)),
    retryable: false
  };
}

export function registerRuntimeBuildTools(
  server: McpServer,
  adapter: RuntimeBuildMcpAdapter = createRuntimeBuildMcpAdapter()
): void {
  const session = z.string().min(1).describe('Exact plan-created ArtDirectorSession string.'),
    files = z
      .array(
        z.object({
          path: z.string().min(1),
          content: z.string().max(MAX_FILE_CHARACTERS),
          kind: z.enum(['react', 'typescript', 'stylesheet', 'text'])
        })
      )
      .min(1)
      .max(64),
    assets = z
      .array(
        z.object({
          path: z.string().min(1),
          mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
          encoding: z.literal('base64'),
          content: z.string().max(MAX_ASSET_CHARACTERS)
        })
      )
      .max(16)
      .optional();

  server.tool(
    'prepare_react_generation',
    'Validate a plan-created Art Director session and return the exact Design Plan v2 generation context and trusted source-file contract. Call this before authoring React source.',
    { session },
    async ({ session: serialized }) => {
      try {
        return toolResult(await adapter.prepare(serialized));
      } catch (error) {
        return toolResult({ error: errorPayload(error) }, true);
      }
    }
  );

  server.tool(
    'build_react_project',
    'Submit MCP-host-model-authored React source for validation, immutable materialization, locked offline installation, production build, and deterministic review. Returns the trusted workspace path and a loopback Vite command. Runtime-owned files and arbitrary dependencies are forbidden.',
    {
      session,
      requestId: z.string().min(1).describe('Stable idempotency id for this source submission.'),
      files,
      assets
    },
    async (input) => {
      try {
        const result = await adapter.build(input);
        return toolResult(result, !result.ok);
      } catch (error) {
        return toolResult({ error: errorPayload(error) }, true);
      }
    }
  );
}
