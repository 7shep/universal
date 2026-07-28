# Downstream APIs

Universal exposes three public Phase 3 boundaries: creative planning in
`@universal/design-engine`, provider-neutral project generation in `@universal/generation`, and
runtime/browser exchange records in `@universal/runtime-contracts`. Trusted host code may import
`@universal/local-runtime`. Consumers should import the narrowest owner and must not import
`@universal/design-mcp` internals.

## Phase 1 compatibility: develop a plan

Plan history is caller-owned and JSON-safe. Pass the latest returned session into the next request;
persist it with the runtime session when continuity across process restarts is required.

```ts
import { createDesignOrchestrator, emptyDesignPlanSession } from '@universal/design-engine';

const design = createDesignOrchestrator();
const first = await design.developPlan({
  brief: { prompt: 'An editorial archive', compositionSeed: 17 },
  session: emptyDesignPlanSession()
});

const second = await design.developPlan({
  brief: { prompt: 'A second editorial direction', compositionSeed: 18 },
  session: first.session
});
```

No process-global history is consulted. Reusing the same input session produces the same
deterministic result. A model-backed provider can be injected through `createDesignOrchestrator`
without changing callers.

Phase 1A callers should migrate from `createDesignEngine().develop(brief)` to the request/result
shape above. `createDesignEngine` remains an alias for the canonical orchestrator factory, but plan
development now uses `developPlan` so session history cannot be implicit.

## Phase 2: develop an approved direction and Design Plan v2

Phase 2 is the recommended domain flow when a consumer needs structured discovery, explicit
approval, differentiated concepts, decision provenance, or a digest-bound plan. All APIs below are
exported from `@universal/design-engine`; consumers should not import source modules directly.

```text
DiscoverySession
  -> CreativeBrief (brief-ready)
  -> CreativeBrief (approval-pending)
  -> CreativeBrief (approved + approvedDigest)
  -> ConceptDirectionSelection
  -> SelectedDirectionEvaluation
  -> DesignPlanV2
```

The MCP package wraps this domain flow in a serialized session. Direct engine consumers own the
current values, timestamps, persistence, and provider calls themselves.

### Discovery and approval

Start a session, record structured answers and a page map, then let deterministic policy decide
whether a brief can be prepared and approved:

```ts
import {
  answerDiscoveryQuestion,
  approveDiscoveryBrief,
  evaluateDiscoveryPolicy,
  prepareDiscoveryBrief,
  requestDiscoveryApproval,
  setDiscoveryPageMap,
  startDiscoverySession,
  type DiscoveryAnswer,
  type PageMap
} from '@universal/design-engine';

const startedAt = '2026-07-28T12:00:00.000Z';
let discovery = startDiscoverySession({
  id: 'discovery:release-planner',
  prompt: 'Create a release-planning product website.',
  now: startedAt
});

const answers: readonly DiscoveryAnswer[] = [
  {
    questionId: 'discovery:purpose',
    topic: 'purpose',
    mode: 'exact',
    value: { summary: 'Convert qualified product teams to trials.' },
    answeredAt: '2026-07-28T12:01:00.000Z'
  },
  {
    questionId: 'discovery:audience',
    topic: 'audience',
    mode: 'exact',
    value: { summary: 'Release managers at small product teams.' },
    answeredAt: '2026-07-28T12:01:01.000Z'
  },
  {
    questionId: 'discovery:page-content',
    topic: 'page-content',
    mode: 'exact',
    value: { summary: 'Opening, workflow, proof, and trial call to action.' },
    answeredAt: '2026-07-28T12:01:02.000Z'
  }
];

for (const answer of answers) discovery = answerDiscoveryQuestion(discovery, answer);

const pageMap: PageMap = {
  kind: 'single-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Understand the release planner and start a trial.',
      primaryMessage: 'Plan releases without the scramble.',
      requiredSections: ['opening', 'workflow', 'proof', 'call to action'],
      requiredContent: ['headline', 'workflow explanation', 'customer proof'],
      primaryAction: 'Start a trial',
      secondaryActions: ['Read the docs'],
      navigationRelationship: 'Section anchors on the only route.',
      uniqueResponsibility: 'Explain the workflow and convert qualified teams.',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['release workflow narrative']
    }
  ]
};

discovery = setDiscoveryPageMap(discovery, pageMap, {
  now: '2026-07-28T12:02:00.000Z',
  source: 'user',
  evidence: 'Page responsibilities supplied by the user.'
});

const policy = evaluateDiscoveryPolicy(discovery);
if (!policy.canPrepareBrief) {
  throw new Error(
    `Discovery is incomplete: ${policy.missing.map((item) => item.topic).join(', ')}`
  );
}

discovery = prepareDiscoveryBrief(discovery, '2026-07-28T12:03:00.000Z');
discovery = requestDiscoveryApproval(discovery, '2026-07-28T12:04:00.000Z');
// This call represents an explicit user/host action; never call it merely because a brief exists.
discovery = approveDiscoveryBrief(discovery, '2026-07-28T12:05:00.000Z', 'alex');

const approvedBrief = discovery.brief!;
```

`DiscoveryInterpretation` is evidence from a model, repository, or user; it is not approval policy.
The deterministic engine decides which gaps block preparation or approval. Answer modes are
`exact`, `preference`, `unknown`, `use-judgment`, and `draft`; they become provenance-bearing
decisions rather than silent assumptions.

To change an approved brief, request and apply a revision with
`requestCreativeBriefRevision`/`reviseCreativeBrief` or the corresponding discovery-session
helpers. The revised brief receives a new digest and must be explicitly approved again. Consumers
must discard or mark stale every concept, direction evaluation, and plan bound to the old digest.

### Concept development

Concept providers are untrusted and return `unknown`. `developConceptDirection` validates their
candidates, requires meaningful differences, computes scores locally, applies brief-fit and
accessibility gates, and returns the recommended candidate:

```ts
import {
  DeterministicOfflineConceptProvider,
  developConceptDirection,
  type ConceptDevelopmentProvider
} from '@universal/design-engine';

const offline = new DeterministicOfflineConceptProvider();
const selection = await developConceptDirection(approvedBrief, offline);

const provider: ConceptDevelopmentProvider = {
  async developConcepts({ brief, candidateCount }) {
    return modelAdapter.generateConceptCandidates({ brief, candidateCount });
  }
};
```

Provider adapters own model credentials, message formats, and network behavior. Do not accept
provider-authored scores or skip `developConceptDirection` validation. Development requires a
digest-valid approved brief.

### Selected-direction evaluation

The plan compiler accepts a `SelectedDirectionEvaluation`, not a loose candidate. A host creates
this record from the recommended candidate (or an explicitly supported selection UI), binds it to
the current approved brief, and signs it with `digestDirectionEvaluation`:

```ts
import {
  digestDirectionEvaluation,
  validateSelectedDirectionEvaluation,
  type SelectedDirectionEvaluation
} from '@universal/design-engine';

const candidate = selection.candidates.find(
  (item) => item.id === selection.recommendedCandidateId
)!;
const score = selection.evaluations.find((item) => item.candidateId === candidate.id)!.totalScore;

const unsigned: Omit<SelectedDirectionEvaluation, 'digest'> = {
  contractVersion: '1.0.0',
  id: `direction-evaluation:${candidate.id}`,
  status: 'selected',
  briefId: approvedBrief.id,
  briefVersion: approvedBrief.version,
  briefDigest: approvedBrief.digest,
  selectedDirection: {
    id: candidate.id,
    label: candidate.title,
    conceptSpine: candidate.centralIdea,
    emotionalObjective: approvedBrief.content.emotionalResponse?.summary ?? candidate.centralIdea,
    recommendation: selection.selectionRationale
  },
  rationale: selection.selectionRationale,
  score: score / 100,
  unresolvedDependencies: [],
  evaluatedAt: '2026-07-28T12:06:00.000Z'
};

const evaluation: SelectedDirectionEvaluation = {
  ...unsigned,
  digest: digestDirectionEvaluation(unsigned)
};
const checked = validateSelectedDirectionEvaluation(evaluation);
if (!checked.ok) throw new Error(`${checked.error.path}: ${checked.error.message}`);
```

The evaluation is stale as soon as its `briefId`, `briefVersion`, or `briefDigest` no longer matches
the approved brief. Re-evaluate instead of rewriting those fields.

### Compile and validate Design Plan v2

Compilation providers return a JSON string matching `DesignPlanV2Draft`. The compiler strictly
parses the draft, verifies provenance IDs, prevents changes to the selected concept spine and
emotional objective, attaches source bindings and the page map, and calculates the plan digest:

```ts
import {
  DesignPlanV2CompilerError,
  compileDesignPlanV2,
  validateDesignPlanV2
} from '@universal/design-engine';

try {
  const plan = compileDesignPlanV2({
    brief: approvedBrief,
    evaluation,
    providerOutput: await planProvider.createDraftJson({ approvedBrief, evaluation }),
    now: '2026-07-28T12:07:00.000Z'
  });

  const valid = validateDesignPlanV2(plan);
  if (!valid.ok) throw new Error(`${valid.error.path}: ${valid.error.message}`);
  await planStore.save(plan);
} catch (error) {
  if (error instanceof DesignPlanV2CompilerError) {
    console.error(error.code, error.path, error.message);
  }
  throw error;
}
```

The compiler rejects unapproved or modified briefs, stale evaluations, invalid provider JSON,
untrusted provenance, selected-direction changes, and invalid final plans. Persist the entire
`DesignPlanV2.source` block and `digest`; they are the audit trail for downstream generation and
review.

## Phase 3: generate a validated React project

Use `createProjectGenerationRequest` to bind an approved Design Plan v2 to opaque project and
revision IDs. The request captures the approved brief, approval digest, selected direction, plan
digest/version, creative context, implementation constraints, and decision provenance. Browser
bundles should use the browser-safe export.

```ts
import { createProjectGenerationRequest } from '@universal/generation/browser';

const request = createProjectGenerationRequest({
  projectId: 'project:keyboard',
  revisionId: 'revision:keyboard:1',
  designPlan: approvedPlan
});
```

Trusted Node code can inject a `ReactGenerationProvider` into `ReactGenerator`. Provider output is
untrusted and must pass `validateProviderProject`; runtime-owned files, path aliases, quotas,
unexpected binary types, case collisions, and secret-bearing content fail closed.
`DeterministicReactProvider` is the credential-free development and golden-test default.

## Phase 3 runtime: `@universal/runtime-contracts` and `@universal/local-runtime`

Browser clients exchange only `@universal/runtime-contracts` DTOs and validate deserialized state
and preview descriptors. They do not import runtime implementation. The trusted process constructs
`RuntimeService`, then optionally exposes it through `RuntimeHttpServer`.

The principal versioned commands and queries are:

- `POST /api/v1/bootstrap`
- `GET /api/v1/state`
- `POST /api/v1/projects/generate` with `Idempotency-Key`
- `GET /api/v1/operations/:id`
- `POST /api/v1/operations/:id/cancel`
- `GET /api/v1/projects/:id/preview`
- `GET /api/v1/events?after=<event-id>`

Every response that crosses a trust boundary is validated. Preview descriptors are accepted only
when loopback-only and bound to the selected project's latest successful build and revision. The
browser never receives raw provider credentials or filesystem/process authority.

## Validate untrusted data

Use `design.validatePlan(value)` or `validateDesignPlan(value)` before accepting Phase 1 provider,
disk, or transport data. Design Plan v2 has its own strict validator. The generation and runtime
packages validate their own serialized boundaries:

- `validateDesignPlanBrief`, `validateDesignDirection`, and `validateDesignReviewContext` for legacy
  downstream DTOs.
- `validateDesignPlanV2` for the canonical approved creative input.
- `validateProjectGenerationRequest` and `validateProviderProject` for generation input/output.
- `validateRuntimeState` and `validatePreviewDescriptor` for persisted/browser runtime data.

Each validator returns a discriminated result with an actionable property `path` on failure.

## Serialized fixtures

Import stable JSON strings from `@universal/design-engine/fixtures`:

```ts
import { parseContract } from '@universal/design-engine';
import { serializedContractFixtures } from '@universal/design-engine/fixtures';

const parsed = parseContract('project-request', serializedContractFixtures['project-request']);
if (!parsed.ok) throw new Error(`${parsed.error.path}: ${parsed.error.message}`);
```

Fixtures are provided for `brief`, `plan`, `direction`, `project-request`, and `review-context`.
Contract tests validate every fixture and require byte-for-byte serialization round trips.

## Consumer map

| Consumer      | Imports and public boundaries                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Studio        | `design-engine`, `generation/browser`, `runtime-contracts`, shared UI                                 |
| Preview       | `runtime-contracts`                                                                                   |
| Generator     | Design Plan v2 plus `generation` request/provider contracts                                           |
| Local runtime | `generation`, `runtime-contracts`, provider adapters injected by trusted startup code                 |
| MCP           | `design-engine` and design-policy packages; runtime/generation only from golden-test development code |
| Benchmark     | Workflow evidence plus explicit rendered/human-review evidence contracts                              |

The Phase 1 MCP handler preserves its existing tool name, schema, and plan response shape. Phase 2
MCP tools add their own serialized Art Director session and must not be reimplemented by importing
MCP internals into a downstream consumer.

See [Phase 3 local runtime](PHASE3_RUNTIME.md) for setup, security boundaries, lifecycle, errors,
testing, and current limitations.
