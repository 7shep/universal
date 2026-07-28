import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  DecisionRevisionInput,
  DiscoveryAnswer,
  DiscoveryInterpretation,
  PageMap
} from '@universal/design-engine';
import {
  ArtDirectorError,
  ArtDirectorOrchestrator,
  parseArtDirectorSession,
  serializeArtDirectorSession,
  type ApproveBriefInput,
  type ArtDirectorSession,
  type OperationRequest,
  type ReviseBriefInput,
  type StartArtDirectionInput,
  type SubmitDiscoveryInput
} from './art-director.js';

export interface ArtDirectorMcpResponse {
  session: string;
  state: ArtDirectorSession;
  data?: unknown;
}

export interface ArtDirectorMcpAdapter {
  startArtDirection(input: StartArtDirectionInput): Promise<ArtDirectorMcpResponse>;
  getDiscoveryQuestions(serializedSession: string): Promise<ArtDirectorMcpResponse>;
  submitDiscoveryAnswers(
    serializedSession: string,
    input: SubmitDiscoveryInput
  ): Promise<ArtDirectorMcpResponse>;
  getCreativeBrief(
    serializedSession: string,
    input?: OperationRequest
  ): Promise<ArtDirectorMcpResponse>;
  reviseCreativeBrief(
    serializedSession: string,
    input: ReviseBriefInput
  ): Promise<ArtDirectorMcpResponse>;
  approveCreativeBrief(
    serializedSession: string,
    input?: ApproveBriefInput
  ): Promise<ArtDirectorMcpResponse>;
  developArtDirection(
    serializedSession: string,
    input?: OperationRequest
  ): Promise<ArtDirectorMcpResponse>;
  getSelectedDirection(
    serializedSession: string,
    input?: OperationRequest
  ): Promise<ArtDirectorMcpResponse>;
  createDesignPlanV2(
    serializedSession: string,
    input?: OperationRequest
  ): Promise<ArtDirectorMcpResponse>;
  getArtDirectionSession(serializedSession: string): Promise<ArtDirectorMcpResponse>;
}

function response(state: ArtDirectorSession, data?: unknown): ArtDirectorMcpResponse {
  return {
    session: serializeArtDirectorSession(state),
    state,
    ...(data === undefined ? {} : { data })
  };
}

export function createArtDirectorMcpAdapter(
  orchestrator = new ArtDirectorOrchestrator()
): ArtDirectorMcpAdapter {
  return {
    async startArtDirection(input) {
      return response(orchestrator.start(input));
    },
    async getDiscoveryQuestions(serializedSession) {
      const state = parseArtDirectorSession(serializedSession);
      return response(state, orchestrator.questions(state));
    },
    async submitDiscoveryAnswers(serializedSession, input) {
      return response(orchestrator.submit(parseArtDirectorSession(serializedSession), input));
    },
    async getCreativeBrief(serializedSession, input = {}) {
      const state = orchestrator.getBrief(parseArtDirectorSession(serializedSession), input);
      return response(state, state.discovery.brief);
    },
    async reviseCreativeBrief(serializedSession, input) {
      const state = orchestrator.revise(parseArtDirectorSession(serializedSession), input);
      return response(state, state.discovery.brief);
    },
    async approveCreativeBrief(serializedSession, input = {}) {
      const state = orchestrator.approve(parseArtDirectorSession(serializedSession), input);
      return response(state, state.discovery.brief);
    },
    async developArtDirection(serializedSession, input = {}) {
      const state = await orchestrator.develop(parseArtDirectorSession(serializedSession), input);
      return response(state, state.concepts);
    },
    async getSelectedDirection(serializedSession, input = {}) {
      const state = orchestrator.selected(parseArtDirectorSession(serializedSession), input);
      return response(state, state.selectedDirection);
    },
    async createDesignPlanV2(serializedSession, input = {}) {
      const state = await orchestrator.createPlan(
        parseArtDirectorSession(serializedSession),
        input
      );
      return response(state, state.designPlan);
    },
    async getArtDirectionSession(serializedSession) {
      const state = parseArtDirectorSession(serializedSession);
      return response(state);
    }
  };
}

const sessionSchema = z
  .string()
  .min(1)
  .describe('Serialized ArtDirectorSession from the prior call.');
const requestIdSchema = z
  .string()
  .min(1)
  .optional()
  .describe('Stable retry id. Reusing it with a different payload is rejected.');

function toolResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

async function safeToolResult(operation: () => Promise<unknown>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    const payload =
      error instanceof ArtDirectorError
        ? error.toJSON()
        : {
            code: 'ART_DIRECTOR_FAILURE',
            message: error instanceof Error ? error.message : String(error),
            action: 'Inspect the supplied session and retry the operation.'
          };
    return { ...toolResult({ error: payload }), isError: true };
  }
}

/**
 * Register the Phase 2 workflow without coupling the transport to discovery,
 * concept-provider, or compiler implementations.
 */
export function registerArtDirectorTools(
  server: McpServer,
  adapter: ArtDirectorMcpAdapter = createArtDirectorMcpAdapter()
): void {
  server.tool(
    'start_art_direction',
    'Start a Phase 2 discovery and art-direction session from an initial project prompt.',
    {
      prompt: z.string().min(1),
      sessionId: z.string().min(1).optional(),
      requestId: requestIdSchema,
      interpretations: z.array(z.unknown()).optional(),
      pageMap: z.unknown().optional()
    },
    async (input) =>
      safeToolResult(() =>
        adapter.startArtDirection({
          ...input,
          interpretations: input.interpretations as readonly DiscoveryInterpretation[] | undefined,
          pageMap: input.pageMap as PageMap | undefined
        })
      )
  );

  server.tool(
    'get_discovery_questions',
    'Return the next deterministic, adaptive discovery question group.',
    { session: sessionSchema },
    async ({ session }) => safeToolResult(() => adapter.getDiscoveryQuestions(session))
  );

  server.tool(
    'submit_discovery_answers',
    'Submit discovery answers, interpreted evidence, and/or a page map.',
    {
      session: sessionSchema,
      requestId: requestIdSchema,
      answers: z.array(z.unknown()).optional(),
      interpretations: z.array(z.unknown()).optional(),
      pageMap: z.unknown().optional()
    },
    async ({ session, ...input }) =>
      safeToolResult(() =>
        adapter.submitDiscoveryAnswers(session, {
          ...input,
          answers: input.answers as readonly DiscoveryAnswer[] | undefined,
          interpretations: input.interpretations as readonly DiscoveryInterpretation[] | undefined,
          pageMap: input.pageMap as PageMap | undefined
        })
      )
  );

  server.tool(
    'get_creative_brief',
    'Prepare and return the creative brief for review. This does not approve it.',
    { session: sessionSchema, requestId: requestIdSchema },
    async ({ session, requestId }) =>
      safeToolResult(() => adapter.getCreativeBrief(session, { requestId }))
  );

  server.tool(
    'revise_creative_brief',
    'Revise a brief and invalidate digest-bound downstream artifacts when necessary.',
    {
      session: sessionSchema,
      reason: z.string().min(1),
      requestId: requestIdSchema,
      decisions: z.array(z.unknown()).optional(),
      interpretations: z.array(z.unknown()).optional(),
      pageMap: z.unknown().optional()
    },
    async ({ session, ...input }) =>
      safeToolResult(() =>
        adapter.reviseCreativeBrief(session, {
          ...input,
          decisions: input.decisions as readonly DecisionRevisionInput[] | undefined,
          interpretations: input.interpretations as readonly DiscoveryInterpretation[] | undefined,
          pageMap: input.pageMap as PageMap | undefined
        })
      )
  );

  server.tool(
    'approve_creative_brief',
    'Explicitly approve the current reviewed brief. Approval is never inferred.',
    {
      session: sessionSchema,
      approvedBy: z.string().min(1).optional(),
      requestId: requestIdSchema
    },
    async ({ session, ...input }) =>
      safeToolResult(() => adapter.approveCreativeBrief(session, input))
  );

  server.tool(
    'develop_art_direction',
    'Develop and evaluate creative concepts from the current approved brief.',
    { session: sessionSchema, requestId: requestIdSchema },
    async ({ session, requestId }) =>
      safeToolResult(() => adapter.developArtDirection(session, { requestId }))
  );

  server.tool(
    'get_selected_direction',
    'Bind and return the recommended direction from current concept development.',
    { session: sessionSchema, requestId: requestIdSchema },
    async ({ session, requestId }) =>
      safeToolResult(() => adapter.getSelectedDirection(session, { requestId }))
  );

  server.tool(
    'create_design_plan_v2',
    'Compile Design Plan v2 from the approved brief and digest-current selected direction.',
    { session: sessionSchema, requestId: requestIdSchema },
    async ({ session, requestId }) =>
      safeToolResult(() => adapter.createDesignPlanV2(session, { requestId }))
  );

  server.tool(
    'get_art_direction_session',
    'Validate and inspect a serialized Art Director session.',
    { session: sessionSchema },
    async ({ session }) => safeToolResult(() => adapter.getArtDirectionSession(session))
  );
}
