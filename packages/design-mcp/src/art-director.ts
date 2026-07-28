import {
  addDiscoveryInterpretation,
  answerDiscoveryQuestion,
  approveDiscoveryBrief,
  getNextDiscoveryQuestions,
  prepareDiscoveryBrief,
  requestDiscoveryApproval,
  requestDiscoveryRevision,
  reviseDiscoveryBrief,
  setDiscoveryPageMap,
  startDiscoverySession,
  validateDiscoverySession,
  type CreativeBrief,
  type CreativeBriefRevisionInput,
  type DecisionRevisionInput,
  type DiscoveryAnswer,
  type DiscoveryInterpretation,
  type DiscoveryQuestion,
  type DiscoverySession,
  type DiscoveryTopic,
  type PageMap
} from '@universal/design-engine';

export const ART_DIRECTOR_SESSION_VERSION = '1.0.0' as const;

export const ART_DIRECTOR_PHASES = [
  'discovery',
  'brief-review',
  'brief-approved',
  'concepts-developed',
  'direction-selected',
  'plan-created'
] as const;

export type ArtDirectorPhase = (typeof ART_DIRECTOR_PHASES)[number];
export type ArtDirectorOperation =
  | 'submit-discovery-answers'
  | 'get-creative-brief'
  | 'revise-creative-brief'
  | 'approve-creative-brief'
  | 'develop-art-direction'
  | 'get-selected-direction'
  | 'create-design-plan-v2';

export interface RequestRecord {
  id: string;
  operation: ArtDirectorOperation;
  inputDigest: string;
  completedAt: string;
}

export interface StaleArtifact {
  staleAt: string;
  staleReason: string;
}

export interface ConceptDevelopmentArtifact {
  briefId: string;
  briefVersion: number;
  approvedBriefDigest: string;
  candidates: readonly unknown[];
  evaluations: readonly unknown[];
  recommendedCandidateId: string;
  selectionRationale: string;
  developedAt: string;
  digest: string;
  stale?: StaleArtifact | undefined;
}

export interface SelectedDirectionArtifact {
  briefId: string;
  briefVersion: number;
  approvedBriefDigest: string;
  conceptDigest: string;
  candidateId: string;
  candidate: unknown;
  evaluation?: unknown;
  rationale: string;
  selectedAt: string;
  digest: string;
  stale?: StaleArtifact | undefined;
}

export interface DesignPlanV2Artifact {
  briefId: string;
  briefVersion: number;
  approvedBriefDigest: string;
  directionDigest: string;
  plan: unknown;
  compiledAt: string;
  digest: string;
  stale?: StaleArtifact | undefined;
}

export interface ArtDirectorSession {
  contractVersion: typeof ART_DIRECTOR_SESSION_VERSION;
  id: string;
  phase: ArtDirectorPhase;
  createdAt: string;
  updatedAt: string;
  discovery: DiscoverySession;
  concepts?: ConceptDevelopmentArtifact | undefined;
  selectedDirection?: SelectedDirectionArtifact | undefined;
  designPlan?: DesignPlanV2Artifact | undefined;
  requestHistory: readonly RequestRecord[];
}

export interface StartArtDirectionInput {
  prompt: string;
  sessionId?: string | undefined;
  requestId?: string | undefined;
  interpretations?: readonly DiscoveryInterpretation[] | undefined;
  pageMap?: PageMap | undefined;
}

export interface SubmitDiscoveryInput {
  answers?: readonly DiscoveryAnswer[] | undefined;
  interpretations?: readonly DiscoveryInterpretation[] | undefined;
  pageMap?: PageMap | undefined;
  requestId?: string | undefined;
}

export interface ReviseBriefInput {
  reason: string;
  decisions?: readonly DecisionRevisionInput[] | undefined;
  interpretations?: readonly DiscoveryInterpretation[] | undefined;
  pageMap?: PageMap | undefined;
  requestId?: string | undefined;
}

export interface ApproveBriefInput {
  approvedBy?: string | undefined;
  requestId?: string | undefined;
}

export interface OperationRequest {
  requestId?: string | undefined;
}

export interface DiscoveryService {
  start(input: {
    id: string;
    prompt: string;
    now: string;
    interpretations?: readonly DiscoveryInterpretation[] | undefined;
    pageMap?: PageMap | undefined;
  }): DiscoverySession;
  questions(session: DiscoverySession): readonly DiscoveryQuestion[];
  submit(
    session: DiscoverySession,
    input: Omit<SubmitDiscoveryInput, 'requestId'>,
    now: string
  ): DiscoverySession;
  prepareBrief(session: DiscoverySession, now: string): DiscoverySession;
  reviseBrief(
    session: DiscoverySession,
    input: Omit<CreativeBriefRevisionInput, 'now'>,
    now: string
  ): DiscoverySession;
  approveBrief(session: DiscoverySession, now: string, approvedBy: string): DiscoverySession;
}

/**
 * The Concept Director owns candidate generation and scoring. The Art Director
 * intentionally accepts its result as unknown and validates only the envelope
 * needed to bind the selection to an approved brief.
 */
export interface ConceptDirectorService {
  develop(brief: CreativeBrief): Promise<unknown>;
}

/**
 * The Plan Compiler owns Design Plan v2 internals. The Art Director supplies
 * approved, digest-bound inputs and treats the compiled plan as an opaque value.
 */
export interface PlanCompilerService {
  compile(input: {
    brief: CreativeBrief;
    conceptDevelopment: ConceptDevelopmentArtifact;
    selectedDirection: SelectedDirectionArtifact;
  }): Promise<unknown>;
}

export interface ArtDirectorDependencies {
  discovery: DiscoveryService;
  conceptDirector: ConceptDirectorService;
  planCompiler: PlanCompilerService;
  now: () => string;
  createSessionId: (prompt: string, requestId?: string) => string;
}

export type ArtDirectorErrorCode =
  | 'INVALID_SESSION'
  | 'ILLEGAL_TRANSITION'
  | 'BRIEF_NOT_READY'
  | 'BRIEF_NOT_APPROVED'
  | 'STALE_CONCEPTS'
  | 'STALE_SELECTED_DIRECTION'
  | 'SERVICE_OUTPUT_INVALID'
  | 'REQUEST_ID_CONFLICT';

export class ArtDirectorError extends Error {
  constructor(
    readonly code: ArtDirectorErrorCode,
    message: string,
    readonly action: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ArtDirectorError';
  }

  toJSON(): Readonly<Record<string, unknown>> {
    return {
      code: this.code,
      message: this.message,
      action: this.action,
      ...(this.details ? { details: this.details } : {})
    };
  }
}

const highImpactTopics = new Set<DiscoveryTopic>([
  'purpose',
  'audience',
  'page-map',
  'page-content',
  'hero',
  'navigation',
  'brand-assets'
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function digest(prefix: string, value: unknown): string {
  return `${prefix}-${fnv1a(canonicalize(value))}`;
}

function assertJsonSerializable(value: unknown, label: string): void {
  try {
    if (JSON.stringify(value) === undefined) throw new Error('value serializes to undefined');
  } catch (error) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      `${label} returned a value that cannot be serialized.`,
      `Update the injected ${label} service to return a JSON-safe object.`,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

function assertPhase(
  session: ArtDirectorSession,
  operation: string,
  allowed: readonly ArtDirectorPhase[]
): void {
  if (allowed.includes(session.phase)) return;
  throw new ArtDirectorError(
    'ILLEGAL_TRANSITION',
    `${operation} is not allowed while the session is in "${session.phase}".`,
    `Complete the current phase first. Allowed phases: ${allowed.join(', ')}.`,
    { phase: session.phase, allowed }
  );
}

function approvedBrief(session: ArtDirectorSession): CreativeBrief {
  const brief = session.discovery.brief;
  if (
    !brief ||
    brief.approval.status !== 'approved' ||
    brief.approval.approvedDigest !== brief.digest
  ) {
    throw new ArtDirectorError(
      'BRIEF_NOT_APPROVED',
      'Concept development requires an explicitly approved, digest-current creative brief.',
      'Review the creative brief, resolve approval blockers, then call approve_creative_brief.'
    );
  }
  return brief;
}

function artifactIsCurrent(
  artifact: { approvedBriefDigest: string; stale?: StaleArtifact | undefined },
  brief: CreativeBrief
): boolean {
  return artifact.approvedBriefDigest === brief.digest && artifact.stale === undefined;
}

function requestReplay(
  session: ArtDirectorSession,
  operation: ArtDirectorOperation,
  requestId: string | undefined,
  payload: unknown
): boolean {
  if (!requestId) return false;
  const previous = session.requestHistory.find((record) => record.id === requestId);
  if (!previous) return false;
  const inputDigest = digest('request', payload);
  if (previous.operation !== operation || previous.inputDigest !== inputDigest) {
    throw new ArtDirectorError(
      'REQUEST_ID_CONFLICT',
      `Request id "${requestId}" was already used for a different operation or payload.`,
      'Retry with the original payload or provide a new request id.',
      { previousOperation: previous.operation, operation }
    );
  }
  return true;
}

function recordRequest(
  session: ArtDirectorSession,
  operation: ArtDirectorOperation,
  requestId: string | undefined,
  payload: unknown,
  now: string
): ArtDirectorSession {
  if (!requestId) return session;
  return {
    ...session,
    requestHistory: [
      ...session.requestHistory,
      { id: requestId, operation, inputDigest: digest('request', payload), completedAt: now }
    ]
  };
}

function staleArtifacts(
  session: ArtDirectorSession,
  now: string,
  reason: string
): Pick<ArtDirectorSession, 'concepts' | 'selectedDirection' | 'designPlan'> {
  const stale = { staleAt: now, staleReason: reason };
  return {
    ...(session.concepts ? { concepts: { ...session.concepts, stale } } : {}),
    ...(session.selectedDirection
      ? { selectedDirection: { ...session.selectedDirection, stale } }
      : {}),
    ...(session.designPlan ? { designPlan: { ...session.designPlan, stale } } : {})
  };
}

function normalizeConceptDevelopment(value: unknown, brief: CreativeBrief, now: string) {
  if (!isRecord(value)) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'Concept Director returned a non-object result.',
      'Return a concept selection with candidates and a recommendedCandidateId.'
    );
  }
  const candidates = value.candidates;
  const evaluations = value.evaluations;
  const recommendedCandidateId = value.recommendedCandidateId;
  const selectionRationale = value.selectionRationale;
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0 ||
    !Array.isArray(evaluations) ||
    !isNonEmptyString(recommendedCandidateId) ||
    !isNonEmptyString(selectionRationale)
  ) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'Concept Director result is missing candidates, evaluations, recommendation, or rationale.',
      'Return the validated Concept Direction Selection contract.'
    );
  }
  const candidateExists = candidates.some(
    (candidate) => isRecord(candidate) && candidate.id === recommendedCandidateId
  );
  if (!candidateExists) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      `Recommended concept "${recommendedCandidateId}" is not present in candidates.`,
      'Return a recommendedCandidateId that identifies one of the validated candidates.'
    );
  }
  const approvedBriefDigest = brief.approval.approvedDigest;
  if (!approvedBriefDigest) {
    throw new ArtDirectorError(
      'BRIEF_NOT_APPROVED',
      'Approved brief digest is missing.',
      'Approve the current brief explicitly before developing concepts.'
    );
  }
  if (
    value.briefId !== brief.id ||
    value.briefVersion !== brief.version ||
    value.approvedBriefDigest !== approvedBriefDigest
  ) {
    throw new ArtDirectorError(
      'STALE_CONCEPTS',
      'Concept Director returned concepts for a different or stale creative brief.',
      'Develop concepts again from the current approved brief.',
      {
        expectedBriefId: brief.id,
        expectedBriefVersion: brief.version,
        expectedBriefDigest: approvedBriefDigest
      }
    );
  }
  const unsigned = {
    briefId: brief.id,
    briefVersion: brief.version,
    approvedBriefDigest,
    candidates,
    evaluations,
    recommendedCandidateId,
    selectionRationale,
    developedAt: now
  };
  assertJsonSerializable(unsigned, 'Concept Director');
  return { ...unsigned, digest: digest('concept-development-v1', unsigned) };
}

function selectRecommendedDirection(
  concepts: ConceptDevelopmentArtifact,
  brief: CreativeBrief,
  now: string
): SelectedDirectionArtifact {
  if (!artifactIsCurrent(concepts, brief)) {
    throw new ArtDirectorError(
      'STALE_CONCEPTS',
      'The developed concepts no longer match the approved creative brief.',
      'Call develop_art_direction again after approving the revised brief.'
    );
  }
  const candidate = concepts.candidates.find(
    (item) => isRecord(item) && item.id === concepts.recommendedCandidateId
  );
  if (!candidate) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'The recommended direction is missing from the concept artifact.',
      'Develop the art direction again with a valid Concept Director service.'
    );
  }
  const evaluation = concepts.evaluations.find(
    (item) => isRecord(item) && item.candidateId === concepts.recommendedCandidateId
  );
  if (!evaluation) {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'The recommended direction has no matching policy-owned evaluation.',
      'Develop the art direction again with a complete Concept Director result.'
    );
  }
  const unsigned = {
    briefId: brief.id,
    briefVersion: brief.version,
    approvedBriefDigest: brief.digest,
    conceptDigest: concepts.digest,
    candidateId: concepts.recommendedCandidateId,
    candidate,
    evaluation,
    rationale: concepts.selectionRationale,
    selectedAt: now
  };
  return { ...unsigned, digest: digest('selected-direction-v1', unsigned) };
}

export function createDiscoveryService(): DiscoveryService {
  return {
    start: startDiscoverySession,
    questions: (session) => getNextDiscoveryQuestions(session),
    submit(session, input, now) {
      let next = session;
      for (const interpretation of input.interpretations ?? [])
        next = addDiscoveryInterpretation(next, interpretation, now);
      for (const answer of input.answers ?? []) next = answerDiscoveryQuestion(next, answer);
      if (input.pageMap)
        next = setDiscoveryPageMap(next, input.pageMap, {
          now,
          source: 'user',
          evidence: 'Page map submitted through the Art Director workflow.'
        });
      return next;
    },
    prepareBrief: prepareDiscoveryBrief,
    reviseBrief(session, input, now) {
      let revisable = session;
      if (
        session.brief &&
        ['approval-pending', 'approved'].includes(session.brief.approval.status)
      ) {
        revisable = requestDiscoveryRevision(session, now, input.reason);
      }
      return reviseDiscoveryBrief(revisable, { ...input, now });
    },
    approveBrief(session, now, approvedBy) {
      const pending =
        session.brief?.approval.status === 'approval-pending'
          ? session
          : requestDiscoveryApproval(session, now);
      return approveDiscoveryBrief(pending, now, approvedBy);
    }
  };
}

const unavailableConceptDirector: ConceptDirectorService = {
  async develop() {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'No Concept Director service is configured for this MCP host.',
      'Inject a ConceptDirectorService when constructing the Art Director orchestrator.'
    );
  }
};

const unavailablePlanCompiler: PlanCompilerService = {
  async compile() {
    throw new ArtDirectorError(
      'SERVICE_OUTPUT_INVALID',
      'No Design Plan v2 Compiler service is configured for this MCP host.',
      'Inject a PlanCompilerService when constructing the Art Director orchestrator.'
    );
  }
};

export function createArtDirectorDependencies(
  overrides: Partial<ArtDirectorDependencies> = {}
): ArtDirectorDependencies {
  return {
    discovery: createDiscoveryService(),
    conceptDirector: unavailableConceptDirector,
    planCompiler: unavailablePlanCompiler,
    now: () => new Date().toISOString(),
    createSessionId: (prompt, requestId) =>
      `art-direction:${requestId?.trim() || fnv1a(prompt.trim())}`,
    ...overrides
  };
}

export class ArtDirectorOrchestrator {
  constructor(
    private readonly services: ArtDirectorDependencies = createArtDirectorDependencies()
  ) {}

  start(input: StartArtDirectionInput): ArtDirectorSession {
    if (!input.prompt.trim()) {
      throw new ArtDirectorError(
        'INVALID_SESSION',
        'An initial project prompt is required.',
        'Provide a non-empty prompt to start_art_direction.'
      );
    }
    const now = this.services.now();
    const id =
      input.sessionId?.trim() || this.services.createSessionId(input.prompt, input.requestId);
    const discovery = this.services.discovery.start({
      id: `discovery:${id}`,
      prompt: input.prompt,
      now,
      interpretations: input.interpretations,
      pageMap: input.pageMap
    });
    return {
      contractVersion: ART_DIRECTOR_SESSION_VERSION,
      id,
      phase: 'discovery',
      createdAt: now,
      updatedAt: now,
      discovery,
      requestHistory: []
    };
  }

  questions(session: ArtDirectorSession): readonly DiscoveryQuestion[] {
    assertPhase(session, 'get_discovery_questions', ['discovery']);
    return this.services.discovery.questions(session.discovery);
  }

  submit(session: ArtDirectorSession, input: SubmitDiscoveryInput): ArtDirectorSession {
    const payload = { ...input, requestId: undefined };
    if (requestReplay(session, 'submit-discovery-answers', input.requestId, payload))
      return session;
    assertPhase(session, 'submit_discovery_answers', ['discovery']);
    if (
      (input.answers?.length ?? 0) === 0 &&
      (input.interpretations?.length ?? 0) === 0 &&
      !input.pageMap
    ) {
      throw new ArtDirectorError(
        'ILLEGAL_TRANSITION',
        'No discovery answers, evidence, or page map were supplied.',
        'Submit at least one answer, interpretation, or page map.'
      );
    }
    const now = this.services.now();
    const next = {
      ...session,
      updatedAt: now,
      discovery: this.services.discovery.submit(session.discovery, input, now)
    };
    return recordRequest(next, 'submit-discovery-answers', input.requestId, payload, now);
  }

  getBrief(session: ArtDirectorSession, request: OperationRequest = {}): ArtDirectorSession {
    const payload = {};
    if (requestReplay(session, 'get-creative-brief', request.requestId, payload)) return session;
    if (session.phase !== 'discovery') {
      if (!session.discovery.brief) {
        throw new ArtDirectorError(
          'INVALID_SESSION',
          'The session phase says a brief exists, but no brief is present.',
          'Restart the session or restore a complete serialized session.'
        );
      }
      return session;
    }
    const now = this.services.now();
    let discovery: DiscoverySession;
    try {
      discovery = this.services.discovery.prepareBrief(session.discovery, now);
    } catch (error) {
      throw new ArtDirectorError(
        'BRIEF_NOT_READY',
        error instanceof Error ? error.message : 'Discovery is not ready for brief review.',
        'Answer the remaining high-impact discovery questions before requesting the brief.'
      );
    }
    const next: ArtDirectorSession = {
      ...session,
      phase: 'brief-review',
      updatedAt: now,
      discovery
    };
    return recordRequest(next, 'get-creative-brief', request.requestId, payload, now);
  }

  revise(session: ArtDirectorSession, input: ReviseBriefInput): ArtDirectorSession {
    const payload = { ...input, requestId: undefined };
    if (requestReplay(session, 'revise-creative-brief', input.requestId, payload)) return session;
    assertPhase(session, 'revise_creative_brief', [
      'brief-review',
      'brief-approved',
      'concepts-developed',
      'direction-selected',
      'plan-created'
    ]);
    if (!input.reason.trim()) {
      throw new ArtDirectorError(
        'ILLEGAL_TRANSITION',
        'A revision reason is required.',
        'Explain what should change before revising the creative brief.'
      );
    }
    const now = this.services.now();
    const changedTopics = new Set<DiscoveryTopic>([
      ...(input.decisions ?? []).map((item) => item.topic),
      ...(input.interpretations ?? []).map((item) => item.topic),
      ...(input.pageMap ? (['page-map'] as const) : [])
    ]);
    const isHighImpact = [...changedTopics].some((topic) => highImpactTopics.has(topic));
    const discovery = this.services.discovery.reviseBrief(
      session.discovery,
      {
        reason: input.reason,
        decisions: input.decisions,
        interpretations: input.interpretations,
        pageMap: input.pageMap
      },
      now
    );
    const reason = isHighImpact
      ? `High-impact brief revision changed: ${[...changedTopics].join(', ')}.`
      : 'The approved brief digest changed and downstream approval must be renewed.';
    const next: ArtDirectorSession = {
      ...session,
      phase: 'brief-review',
      updatedAt: now,
      discovery,
      ...staleArtifacts(session, now, reason)
    };
    return recordRequest(next, 'revise-creative-brief', input.requestId, payload, now);
  }

  approve(session: ArtDirectorSession, input: ApproveBriefInput = {}): ArtDirectorSession {
    const approvedBy = input.approvedBy?.trim() || 'user';
    const payload = { approvedBy };
    if (requestReplay(session, 'approve-creative-brief', input.requestId, payload)) return session;
    assertPhase(session, 'approve_creative_brief', ['brief-review']);
    if (!session.discovery.brief) {
      throw new ArtDirectorError(
        'BRIEF_NOT_READY',
        'No creative brief exists to approve.',
        'Call get_creative_brief before approving.'
      );
    }
    const now = this.services.now();
    let discovery: DiscoverySession;
    try {
      discovery = this.services.discovery.approveBrief(session.discovery, now, approvedBy);
    } catch (error) {
      throw new ArtDirectorError(
        'BRIEF_NOT_READY',
        error instanceof Error ? error.message : 'The brief cannot be approved yet.',
        'Resolve all high-impact blockers, review the brief, then approve it explicitly.'
      );
    }
    const next: ArtDirectorSession = {
      ...session,
      phase: 'brief-approved',
      updatedAt: now,
      discovery
    };
    return recordRequest(next, 'approve-creative-brief', input.requestId, payload, now);
  }

  async develop(
    session: ArtDirectorSession,
    request: OperationRequest = {}
  ): Promise<ArtDirectorSession> {
    const payload = {};
    if (requestReplay(session, 'develop-art-direction', request.requestId, payload)) return session;
    assertPhase(session, 'develop_art_direction', ['brief-approved']);
    const brief = approvedBrief(session);
    const now = this.services.now();
    const output = await this.services.conceptDirector.develop(brief);
    const concepts = normalizeConceptDevelopment(output, brief, now);
    const next: ArtDirectorSession = {
      ...session,
      phase: 'concepts-developed',
      updatedAt: now,
      concepts,
      selectedDirection: undefined,
      designPlan: undefined
    };
    return recordRequest(next, 'develop-art-direction', request.requestId, payload, now);
  }

  selected(session: ArtDirectorSession, request: OperationRequest = {}): ArtDirectorSession {
    const payload = {};
    if (requestReplay(session, 'get-selected-direction', request.requestId, payload))
      return session;
    if (session.phase === 'direction-selected' || session.phase === 'plan-created') {
      const brief = approvedBrief(session);
      if (!session.selectedDirection || !artifactIsCurrent(session.selectedDirection, brief)) {
        throw new ArtDirectorError(
          'STALE_SELECTED_DIRECTION',
          'The selected direction is stale or missing for the current approved brief.',
          'Develop art direction again and retrieve the new selected direction.'
        );
      }
      return session;
    }
    assertPhase(session, 'get_selected_direction', ['concepts-developed']);
    const brief = approvedBrief(session);
    if (!session.concepts) {
      throw new ArtDirectorError(
        'STALE_CONCEPTS',
        'No concept development artifact is present.',
        'Call develop_art_direction first.'
      );
    }
    const now = this.services.now();
    const selectedDirection = selectRecommendedDirection(session.concepts, brief, now);
    const next: ArtDirectorSession = {
      ...session,
      phase: 'direction-selected',
      updatedAt: now,
      selectedDirection
    };
    return recordRequest(next, 'get-selected-direction', request.requestId, payload, now);
  }

  async createPlan(
    session: ArtDirectorSession,
    request: OperationRequest = {}
  ): Promise<ArtDirectorSession> {
    const payload = {};
    if (requestReplay(session, 'create-design-plan-v2', request.requestId, payload)) return session;
    if (session.phase === 'plan-created') {
      const brief = approvedBrief(session);
      if (
        session.designPlan &&
        artifactIsCurrent(session.designPlan, brief) &&
        session.selectedDirection &&
        session.designPlan.directionDigest === session.selectedDirection.digest
      )
        return session;
    }
    assertPhase(session, 'create_design_plan_v2', ['direction-selected']);
    const brief = approvedBrief(session);
    if (
      !session.concepts ||
      !artifactIsCurrent(session.concepts, brief) ||
      !session.selectedDirection ||
      !artifactIsCurrent(session.selectedDirection, brief) ||
      session.selectedDirection.conceptDigest !== session.concepts.digest
    ) {
      throw new ArtDirectorError(
        'STALE_SELECTED_DIRECTION',
        'The selected direction does not match the current concepts and approved brief.',
        'Develop art direction again, then retrieve the selected direction.'
      );
    }
    const now = this.services.now();
    const plan = await this.services.planCompiler.compile({
      brief,
      conceptDevelopment: session.concepts,
      selectedDirection: session.selectedDirection
    });
    assertJsonSerializable(plan, 'Plan Compiler');
    if (!isRecord(plan)) {
      throw new ArtDirectorError(
        'SERVICE_OUTPUT_INVALID',
        'Plan Compiler returned a non-object Design Plan v2.',
        'Return a validated Design Plan v2 object from the injected compiler.'
      );
    }
    const unsigned = {
      briefId: brief.id,
      briefVersion: brief.version,
      approvedBriefDigest: brief.digest,
      directionDigest: session.selectedDirection.digest,
      plan,
      compiledAt: now
    };
    const designPlan = { ...unsigned, digest: digest('art-director-plan-v2', unsigned) };
    const next: ArtDirectorSession = {
      ...session,
      phase: 'plan-created',
      updatedAt: now,
      designPlan
    };
    return recordRequest(next, 'create-design-plan-v2', request.requestId, payload, now);
  }
}

export function serializeArtDirectorSession(session: ArtDirectorSession): string {
  assertArtDirectorSession(session);
  return `${JSON.stringify(session, null, 2)}\n`;
}

export function parseArtDirectorSession(serialized: string): ArtDirectorSession {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Art Director session is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'Pass the exact serialized session returned by the previous workflow operation.'
    );
  }
  return assertArtDirectorSession(value);
}

function hasArtifactBinding(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (
    !isNonEmptyString(value.briefId) ||
    !Number.isSafeInteger(value.briefVersion) ||
    Number(value.briefVersion) < 1 ||
    !isNonEmptyString(value.approvedBriefDigest) ||
    !isNonEmptyString(value.digest)
  )
    return false;
  if (value.stale === undefined) return true;
  return (
    isRecord(value.stale) &&
    isNonEmptyString(value.stale.staleAt) &&
    isNonEmptyString(value.stale.staleReason)
  );
}

function hasValidConceptDigest(value: Record<string, unknown>): boolean {
  return (
    value.digest ===
    digest('concept-development-v1', {
      briefId: value.briefId,
      briefVersion: value.briefVersion,
      approvedBriefDigest: value.approvedBriefDigest,
      candidates: value.candidates,
      evaluations: value.evaluations,
      recommendedCandidateId: value.recommendedCandidateId,
      selectionRationale: value.selectionRationale,
      developedAt: value.developedAt
    })
  );
}

function hasValidDirectionDigest(value: Record<string, unknown>): boolean {
  return (
    value.digest ===
    digest('selected-direction-v1', {
      briefId: value.briefId,
      briefVersion: value.briefVersion,
      approvedBriefDigest: value.approvedBriefDigest,
      conceptDigest: value.conceptDigest,
      candidateId: value.candidateId,
      candidate: value.candidate,
      ...(value.evaluation === undefined ? {} : { evaluation: value.evaluation }),
      rationale: value.rationale,
      selectedAt: value.selectedAt
    })
  );
}

function hasValidPlanDigest(value: Record<string, unknown>): boolean {
  return (
    value.digest ===
    digest('art-director-plan-v2', {
      briefId: value.briefId,
      briefVersion: value.briefVersion,
      approvedBriefDigest: value.approvedBriefDigest,
      directionDigest: value.directionDigest,
      plan: value.plan,
      compiledAt: value.compiledAt
    })
  );
}
function hasCompleteConceptSelection(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.candidates) || !Array.isArray(value.evaluations)) return false;
  if (!isNonEmptyString(value.recommendedCandidateId)) return false;
  return (
    value.candidates.some(
      (candidate) => isRecord(candidate) && candidate.id === value.recommendedCandidateId
    ) &&
    value.evaluations.some(
      (evaluation) =>
        isRecord(evaluation) && evaluation.candidateId === value.recommendedCandidateId
    )
  );
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right);
}
export function assertArtDirectorSession(value: unknown): ArtDirectorSession {
  if (!isRecord(value)) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Art Director session must be an object.',
      'Pass a serialized ArtDirectorSession returned by start_art_direction.'
    );
  }
  if (value.contractVersion !== ART_DIRECTOR_SESSION_VERSION) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Unsupported Art Director session version "${String(value.contractVersion)}".`,
      `Use contract version ${ART_DIRECTOR_SESSION_VERSION}.`
    );
  }
  if (
    !isNonEmptyString(value.id) ||
    !ART_DIRECTOR_PHASES.includes(value.phase as ArtDirectorPhase) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.updatedAt) ||
    !Array.isArray(value.requestHistory)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Art Director session metadata is incomplete or malformed.',
      'Restart the workflow or restore the complete serialized session.'
    );
  }
  const operations = new Set<string>([
    'submit-discovery-answers',
    'get-creative-brief',
    'revise-creative-brief',
    'approve-creative-brief',
    'develop-art-direction',
    'get-selected-direction',
    'create-design-plan-v2'
  ]);
  const requestIds = new Set<string>();
  for (const record of value.requestHistory) {
    if (
      !isRecord(record) ||
      !isNonEmptyString(record.id) ||
      !operations.has(String(record.operation)) ||
      !isNonEmptyString(record.inputDigest) ||
      !isNonEmptyString(record.completedAt) ||
      requestIds.has(record.id)
    ) {
      throw new ArtDirectorError(
        'INVALID_SESSION',
        'Art Director request history is malformed or contains duplicate request ids.',
        'Restore the exact session returned by the previous successful operation.'
      );
    }
    requestIds.add(record.id);
  }
  if (
    value.concepts !== undefined &&
    (!hasArtifactBinding(value.concepts) ||
      !hasValidConceptDigest(value.concepts) ||
      !Array.isArray(value.concepts.candidates) ||
      !Array.isArray(value.concepts.evaluations) ||
      !hasCompleteConceptSelection(value.concepts) ||
      !isNonEmptyString(value.concepts.selectionRationale) ||
      !isNonEmptyString(value.concepts.developedAt))
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Concept development artifact is malformed.',
      'Restore the exact concept artifact returned by develop_art_direction.'
    );
  }
  if (
    value.selectedDirection !== undefined &&
    (!hasArtifactBinding(value.selectedDirection) ||
      !hasValidDirectionDigest(value.selectedDirection) ||
      !isNonEmptyString(value.selectedDirection.conceptDigest) ||
      !isNonEmptyString(value.selectedDirection.candidateId) ||
      !isRecord(value.selectedDirection.candidate) ||
      !isRecord(value.selectedDirection.evaluation) ||
      !isNonEmptyString(value.selectedDirection.rationale) ||
      !isNonEmptyString(value.selectedDirection.selectedAt))
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Selected direction artifact is malformed.',
      'Restore the exact direction returned by get_selected_direction.'
    );
  }
  if (
    value.designPlan !== undefined &&
    (!hasArtifactBinding(value.designPlan) ||
      !hasValidPlanDigest(value.designPlan) ||
      !isNonEmptyString(value.designPlan.directionDigest) ||
      !isRecord(value.designPlan.plan) ||
      !isNonEmptyString(value.designPlan.compiledAt))
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Design Plan v2 artifact is malformed.',
      'Restore the exact plan returned by create_design_plan_v2.'
    );
  }
  const discovery = validateDiscoverySession(value.discovery);
  if (!discovery.ok) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Discovery session is invalid at ${discovery.error.path}: ${discovery.error.message}`,
      'Restore the complete discovery state returned by the previous operation.'
    );
  }
  const phase = value.phase as ArtDirectorPhase;
  if (
    [
      'brief-review',
      'brief-approved',
      'concepts-developed',
      'direction-selected',
      'plan-created'
    ].includes(phase) &&
    !discovery.value.brief
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Phase "${phase}" requires a creative brief.`,
      'Restore the missing brief or restart the workflow.'
    );
  }
  const brief = discovery.value.brief;
  const concepts = isRecord(value.concepts) ? value.concepts : undefined;
  const selectedDirection = isRecord(value.selectedDirection) ? value.selectedDirection : undefined;
  const designPlan = isRecord(value.designPlan) ? value.designPlan : undefined;
  if (
    brief &&
    concepts &&
    concepts.stale === undefined &&
    (concepts.briefId !== brief.id ||
      concepts.briefVersion !== brief.version ||
      concepts.approvedBriefDigest !== brief.digest)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Current concepts are not bound to the current approved brief.',
      'Restore the exact concept artifact returned for this approved brief.'
    );
  }
  if (selectedDirection && selectedDirection.stale === undefined) {
    const candidate = concepts?.candidates;
    const evaluations = concepts?.evaluations;
    const expectedCandidate = Array.isArray(candidate)
      ? candidate.find((item) => isRecord(item) && item.id === selectedDirection.candidateId)
      : undefined;
    const expectedEvaluation = Array.isArray(evaluations)
      ? evaluations.find(
          (item) => isRecord(item) && item.candidateId === selectedDirection.candidateId
        )
      : undefined;
    if (
      !brief ||
      !concepts ||
      concepts.stale !== undefined ||
      selectedDirection.briefId !== brief.id ||
      selectedDirection.briefVersion !== brief.version ||
      selectedDirection.approvedBriefDigest !== brief.digest ||
      selectedDirection.conceptDigest !== concepts.digest ||
      selectedDirection.candidateId !== concepts.recommendedCandidateId ||
      !sameJsonValue(selectedDirection.candidate, expectedCandidate) ||
      !sameJsonValue(selectedDirection.evaluation, expectedEvaluation)
    ) {
      throw new ArtDirectorError(
        'INVALID_SESSION',
        'Current selected direction is not bound to the current concepts and approved brief.',
        'Restore the exact selected direction returned for this concept artifact.'
      );
    }
  }
  if (
    designPlan &&
    designPlan.stale === undefined &&
    (!brief ||
      !selectedDirection ||
      selectedDirection.stale !== undefined ||
      designPlan.briefId !== brief.id ||
      designPlan.briefVersion !== brief.version ||
      designPlan.approvedBriefDigest !== brief.digest ||
      designPlan.directionDigest !== selectedDirection.digest)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Current Design Plan v2 is not bound to the current selected direction and approved brief.',
      'Restore the exact plan returned for this selected direction.'
    );
  }
  if (phase === 'brief-review' && brief?.approval.status !== 'brief-ready') {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Brief-review phase requires a reviewable, unapproved brief.',
      'Restore the current brief-review session before approval.'
    );
  }
  if (
    ['brief-approved', 'concepts-developed', 'direction-selected', 'plan-created'].includes(
      phase
    ) &&
    (!brief ||
      brief.approval.status !== 'approved' ||
      brief.approval.approvedDigest !== brief.digest)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Phase "${phase}" requires an explicitly approved, digest-current brief.`,
      'Return to brief review and call approve_creative_brief explicitly.'
    );
  }
  if (
    ['concepts-developed', 'direction-selected', 'plan-created'].includes(phase) &&
    (!concepts || concepts.stale !== undefined)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Phase "${phase}" requires a concept development artifact.`,
      'Restore the missing concept artifact or develop art direction again.'
    );
  }
  if (
    ['direction-selected', 'plan-created'].includes(phase) &&
    (!selectedDirection || selectedDirection.stale !== undefined)
  ) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      `Phase "${phase}" requires a selected direction.`,
      'Restore the missing selection or retrieve the selected direction again.'
    );
  }
  if (phase === 'plan-created' && (!designPlan || designPlan.stale !== undefined)) {
    throw new ArtDirectorError(
      'INVALID_SESSION',
      'Phase "plan-created" requires a Design Plan v2 artifact.',
      'Restore the missing plan or compile it again.'
    );
  }
  return value as unknown as ArtDirectorSession;
}
