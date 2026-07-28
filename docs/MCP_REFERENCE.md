# Universal MCP Tool Reference

Universal exposes 14 tools over the local stdio MCP server. Tool results use the MCP text-content
envelope; its text is pretty-printed JSON. Build and connect the server with
[CODEX_MCP_SETUP.md](CODEX_MCP_SETUP.md). The Phase 1 compatibility and policy tools match the Zod
schemas in `packages/design-mcp/src/index.ts`; the Phase 2 Art Director tools match
`packages/design-mcp/src/art-director-mcp.ts`.

## Phase 2 Art Director workflow

Use Phase 2 when a project needs discovery, explicit brief approval, concept development,
direction selection, provenance, or Design Plan v2. The normal sequence is:

```text
start_art_direction
  -> get_discovery_questions
  -> submit_discovery_answers
  -> get_creative_brief
  -> approve_creative_brief
  -> develop_art_direction
  -> get_selected_direction
  -> create_design_plan_v2
```

Call `submit_discovery_answers` and `get_discovery_questions` more than once when discovery requires
another group. Call `revise_creative_brief` from brief review or a later phase when a reviewed
decision changes. Call `get_art_direction_session` at any time to validate and inspect a session.

### Session handoff and response envelope

Except for the initial call, every Phase 2 request includes `session`: the exact serialized string
returned by the immediately preceding operation. Do not edit it, extract only its `state`, or reuse
an older string after a successful mutation.

Every successful Phase 2 response has this JSON shape:

```ts
interface ArtDirectorMcpResponse {
  session: string; // complete serialized ArtDirectorSession for the next call
  state: ArtDirectorSession;
  data?: unknown; // operation-specific view described below
}
```

The session phase is one of `discovery`, `brief-review`, `brief-approved`, `concepts-developed`,
`direction-selected`, or `plan-created`. `start_art_direction` uses optional `requestId` when it
derives a session ID. Subsequent mutating operations accept an optional stable `requestId` and
record it in the session. Retrying the same operation with the same ID and payload returns the
recorded result; reusing that ID with a different payload returns `REQUEST_ID_CONFLICT`.

### `start_art_direction`

Starts a session. `prompt` is required. Advanced callers may seed repository/model interpretations
or a page map; interpretations are evidence and do not bypass deterministic discovery policy.

```json
{
  "prompt": "Create a release-planning product website.",
  "sessionId": "art-direction:release-planner",
  "requestId": "release-planner:start:1"
}
```

The response phase is `discovery`. `state.discovery` contains the new `DiscoverySession`; this
operation does not include `data`.

### `get_discovery_questions`

Returns the next deterministic, adaptive question group without mutating the session.

```json
{ "session": "<session returned by start_art_direction>" }
```

`data` is `DiscoveryQuestion[]`. Each question contains `id`, `topic`, `group`, `impact`, `prompt`,
`rationale`, and `order`.

### `submit_discovery_answers`

Submits any combination of answers, evidence-only interpretations, and a page map. Answer modes are
`exact`, `preference`, `unknown`, `use-judgment`, and `draft`.

```json
{
  "session": "<latest session>",
  "requestId": "release-planner:discovery:1",
  "answers": [
    {
      "questionId": "discovery:purpose",
      "topic": "purpose",
      "mode": "exact",
      "value": { "summary": "Convert qualified product teams to trials." },
      "answeredAt": "2026-07-28T12:00:01.000Z"
    },
    {
      "questionId": "discovery:audience",
      "topic": "audience",
      "mode": "exact",
      "value": { "summary": "Release managers at small product teams." },
      "answeredAt": "2026-07-28T12:00:01.000Z"
    },
    {
      "questionId": "discovery:page-content",
      "topic": "page-content",
      "mode": "exact",
      "value": { "summary": "Opening, workflow, proof, and trial call to action." },
      "answeredAt": "2026-07-28T12:00:01.000Z"
    }
  ],
  "pageMap": {
    "kind": "single-page",
    "pages": [
      {
        "id": "home",
        "route": "/",
        "name": "Home",
        "userGoal": "Understand the release planner and start a trial.",
        "primaryMessage": "Plan releases without the scramble.",
        "requiredSections": ["opening", "workflow", "proof", "call to action"],
        "requiredContent": ["headline", "workflow explanation", "customer proof"],
        "primaryAction": "Start a trial",
        "secondaryActions": ["Read the docs"],
        "navigationRelationship": "Section anchors on the only route.",
        "uniqueResponsibility": "Explain the workflow and convert qualified teams.",
        "sharedElements": ["navigation", "footer"],
        "pageSpecificElements": ["release workflow narrative"]
      }
    ]
  }
}
```

The response stays in `discovery` and has no `data`. Call `get_discovery_questions` again to see
what remains. High-impact missing information prevents brief preparation.

### `get_creative_brief`

Prepares a complete discovery session as a reviewable brief. It never approves the brief.

```json
{
  "session": "<latest discovery session>",
  "requestId": "release-planner:brief:1"
}
```

The response phase is `brief-review`; `data` is the `CreativeBrief`. A brief records versioned
content, decision provenance, unresolved information, revisions, a digest, and approval state.
Incomplete high-impact discovery returns `BRIEF_NOT_READY`.

### `revise_creative_brief`

Revises a reviewed or approved brief. `reason` is required; callers may replace decision evidence,
interpretations, or the page map.

```json
{
  "session": "<latest session>",
  "reason": "Expand the audience to regulated organizations.",
  "requestId": "release-planner:revise-audience:1",
  "decisions": [
    {
      "topic": "audience",
      "value": { "summary": "Release leaders at regulated product organizations." },
      "source": "user",
      "disposition": "explicit",
      "answerMode": "exact",
      "evidence": "The user expanded the target audience."
    }
  ]
}
```

`data` is the revised `CreativeBrief`, and the phase returns to `brief-review`. A material revision
revokes approval and marks existing concepts, selected direction, and plan artifacts stale. They
cannot cross a later phase boundary; reapprove and recompute them.

### `approve_creative_brief`

Explicitly approves the exact reviewed brief digest. Approval is never inferred.

```json
{
  "session": "<brief-review session>",
  "approvedBy": "alex",
  "requestId": "release-planner:approve-brief:1"
}
```

The response phase is `brief-approved`; `data` is the approved `CreativeBrief`. Its
`approval.approvedDigest` binds approval to the current brief content.

### `develop_art_direction`

Develops and evaluates differentiated concepts from the approved brief.

```json
{
  "session": "<brief-approved session>",
  "requestId": "release-planner:develop:1"
}
```

The response phase is `concepts-developed`; `data` is a `ConceptDevelopmentArtifact` containing
candidate and evaluation arrays, the recommended candidate ID, selection rationale, the approved
brief digest, and its own digest. Calling this before approval returns an error.

### `get_selected_direction`

Binds and returns the recommended candidate from the current concept artifact.

```json
{
  "session": "<concepts-developed session>",
  "requestId": "release-planner:select:1"
}
```

The response phase is `direction-selected`; `data` is a `SelectedDirectionArtifact` containing the
candidate, optional evaluation, rationale, approved-brief digest, concept digest, and direction
digest. This operation selects the recommendation; the current MCP schema does not accept a
different candidate ID.

### `create_design_plan_v2`

Compiles Design Plan v2 from the approved brief and digest-current selected direction.

```json
{
  "session": "<direction-selected session>",
  "requestId": "release-planner:plan:1"
}
```

The response phase is `plan-created`; `data` is a `DesignPlanV2Artifact`. Its `plan` is the validated
Design Plan v2 and its envelope binds the plan to the approved brief and selected-direction digests.
Use this tool instead of `create_design_plan` when provenance and approval gates matter.

### `get_art_direction_session`

Validates and inspects a serialized session without advancing it.

```json
{ "session": "<any current serialized ArtDirectorSession>" }
```

The response returns `session` and parsed `state` with no `data`. Digest, artifact-binding, or shape
tampering returns `INVALID_SESSION`.

## Phase 1 compatibility and policy tools

## `create_design_plan`

Creates a deterministic structured direction before implementation. Only `prompt` is required;
`compositionSeed` must be a non-negative integer.

### Request

```json
{
  "prompt": "Create an editorial site for an independent architecture journal.",
  "websiteType": "Editorial archive",
  "preferences": ["warm monochrome", "large typography"],
  "avoid": ["dashboard cards", "decorative gradients"],
  "compositionSeed": 17,
  "recentSignatures": [
    {
      "heroArchetype": "poster",
      "navigationMode": "perimeter",
      "sectionSequence": ["poster opener", "project index"],
      "preset": "editorial"
    }
  ]
}
```

Navigation modes are `standard-horizontal`, `corner-controls`, `perimeter`, `overlay-minimal`,
`vertical-rail`, `masthead`, `embedded-index`, and `utility-dock`. Presets are `editorial`,
`industrial`, `minimal`, `playful`, `technical`, and `luxury`.

### Response shape

```ts
interface DesignPlan {
  preset: 'editorial' | 'industrial' | 'minimal' | 'playful' | 'technical' | 'luxury';
  concept: string;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: readonly { id: string; pattern: string; description: string }[];
  heroComposition: HeroArchetype;
  navigation: NavigationDefinition;
  composition: {
    hero: HeroArchetype;
    navigation: NavigationDefinition;
    signature: CompositionSignature;
  };
  compositionSeed: number;
  compositionSignature: CompositionSignature;
  noveltyScore: number;
  implementationPrompt: string;
  prohibitedPatterns: readonly string[];
  designTokens: {
    colors: Record<'background' | 'surface' | 'text' | 'muted' | 'accent', string>;
    typography: { displayStyle: string; bodyStyle: string; displayScale: readonly string[] };
    spacing: { sectionPadding: string; contentGap: string };
    shape: { smallRadius: string; largeRadius: string };
  };
  preferredVisualTreatments: readonly string[];
  tasteDirection: TasteDirection;
  motionDirection?: {
    signature: string;
    trigger: 'scroll-driven';
    technique: string;
    layers: readonly string[];
    behavior: readonly string[];
    performance: readonly string[];
    reducedMotion: string;
  };
  implementationNotes: readonly string[];
  avoid: readonly string[];
}
```

`CompositionSignature` contains `heroArchetype`, `navigationMode`, `sectionSequence`, and `preset`.
`TasteDirection` identifies the profile, states a thesis, records three to five rationale-bearing
decisions, explains typography, color, imagery, navigation, and motion, defines reduced-motion
behavior, and records rejected defaults and exceptions.

## `get_design_rules`

Returns implementation constraints plus guidance for one category. `category` defaults to `general`.

### Request

```json
{
  "category": "website"
}
```

Categories are `general`, `website`, `typography`, `composition`, `imagery`, and `motion`.

### Response shape

```ts
interface DesignRules {
  category: 'general' | 'website' | 'typography' | 'composition' | 'imagery' | 'motion';
  tasteProfile: { id: string; version: string };
  categoryPrinciples: readonly string[];
  compositionPrinciples: readonly string[];
  typographyPrinciples: readonly string[];
  spacingPrinciples: readonly string[];
  imagePrinciples: readonly string[];
  motionPrinciples: readonly string[];
  antiPatterns: readonly string[];
  implementationConstraints: readonly string[];
}
```

The current `website` response identifies `anti-slop-craft-v1` version `1.0.0` and includes
first-viewport, varied-composition, typography, spacing, imagery, motion, anti-pattern, and static
implementation guidance.

## `get_taste_profile`

Returns the active versioned taste policy used by planning and deterministic review.

### Request

```json
{}
```

### Response shape

```ts
interface DesignTasteProfile {
  id: string;
  name: string;
  version: string;
  principles: readonly {
    id: string;
    statement: string;
    rationale: string;
    appliesTo:
      | 'typography'
      | 'color'
      | 'composition'
      | 'navigation'
      | 'imagery'
      | 'copy'
      | 'motion'
      | 'controls';
    priority: 'required' | 'preferred';
  }[];
  antiPatterns: readonly {
    id: string;
    description: string;
    detectionHints: readonly string[];
    recommendation: string;
    severityDefault: 'info' | 'warning' | 'error';
    allowWhen: readonly string[];
  }[];
  positiveReferenceNotes: readonly string[];
  selectionCriteria: readonly string[];
}
```

The current profile is `anti-slop-craft-v1`, named `Anti-slop craft`, at version `1.0.0`. Consumers
should use returned identity fields rather than hard-coding them.

## `review_implementation`

Runs deterministic source review against taste and composition guardrails. It does not inspect image
pixels; `visualEvidence` records screenshots and human observations supplied by the client.

### Request

This valid example includes desktop and mobile visual evidence.

```json
{
  "files": [
    {
      "path": "src/page.tsx",
      "content": "<main><header className=\"masthead\"><h1>Field notes from the northern watershed</h1></header><article>Observed species and seasonal changes.</article></main>"
    },
    {
      "path": "src/styles.css",
      "content": ".masthead{display:grid;grid-template-columns:2fr 1fr}.masthead h1{font-family:Georgia,serif;font-size:clamp(4rem,9vw,9rem)}article{font-family:Arial,sans-serif;max-width:62ch}"
    }
  ],
  "visualEvidence": {
    "screenshots": [
      {
        "viewport": "desktop",
        "location": "artifacts/home-desktop.png",
        "notes": "No empty media region."
      },
      {
        "viewport": "mobile",
        "location": "artifacts/home-mobile.png",
        "notes": "No horizontal clipping."
      }
    ],
    "checkedForEmptySpace": true,
    "checkedForMissingMedia": true,
    "visualObservations": [
      {
        "viewport": "desktop",
        "observation": "Primary headings and controls remain optically balanced."
      },
      {
        "viewport": "mobile",
        "observation": "Primary headings and controls remain legible and centered."
      }
    ]
  },
  "compositionContext": {
    "expectedSignature": {
      "heroArchetype": "editorial-masthead",
      "navigationMode": "masthead",
      "sectionSequence": ["offset typographic opener", "captioned index"],
      "preset": "editorial"
    },
    "recentSignatures": []
  }
}
```

Paths are descriptive evidence; the MCP server does not read those files from disk.

### Response shape

```ts
interface ImplementationReview {
  status: 'pass' | 'revision_recommended';
  score: number;
  findings: readonly {
    rule: string;
    severity: 'info' | 'warning' | 'error';
    rationale: string;
    actionableFix: string;
    message: string;
    suggestion: string;
  }[];
  passedRules: readonly string[];
  passedPrinciples: readonly string[];
  unresolvedDecisions: readonly string[];
  policy: { profileId: string; profileVersion: string };
}
```

`message` and `suggestion` are compatibility aliases for `rationale` and `actionableFix`.

## Errors and compatibility

The MCP SDK validates requests before invoking a tool. Invalid enum values, missing or empty required
strings, and an empty `files` array fail at that boundary. Provider-specific message formatting stays
outside this package.

Phase 2 operation failures return MCP text content with `isError: true`:

```json
{
  "error": {
    "code": "ILLEGAL_TRANSITION",
    "message": "develop_art_direction is not allowed while the session is in \discovery\.",
    "action": "Complete the current phase first. Allowed phases: brief-approved.",
    "details": { "phase": "discovery", "allowed": ["brief-approved"] }
  }
}
```

Art Director error codes are `INVALID_SESSION`, `ILLEGAL_TRANSITION`, `BRIEF_NOT_READY`,
`BRIEF_NOT_APPROVED`, `STALE_CONCEPTS`, `STALE_SELECTED_DIRECTION`, `SERVICE_OUTPUT_INVALID`, and
`REQUEST_ID_CONFLICT`. Always follow the returned `action`; `details` may identify the failed phase,
binding, or request ID. Do not repair a serialized session manually. Return to the last trusted
session, complete the required transition, or recompute stale artifacts.

`create_design_plan` is the deterministic Phase 1 compatibility API. It remains appropriate for a
single lower-level plan without discovery or approval. It does not start or resume an Art Director
session and cannot be upgraded in place to Design Plan v2. Use the Phase 2 sequence for new callers
that need provenance, creative-brief approval, concept selection, or plan source bindings.
