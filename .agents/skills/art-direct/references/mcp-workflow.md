# Art Director MCP workflow reference

Detailed tool contracts for `/art-direct`. This is a reading aid, not a duplicate source of truth —
for the authoritative shapes see `docs/MCP_REFERENCE.md` and the Zod schemas in
`packages/design-mcp/src/art-director-mcp.ts` and `packages/design-mcp/src/runtime-build-mcp.ts`.
If those files and this one ever disagree, the source wins.

## Tool sequence

```text
start_art_direction
  -> get_discovery_questions
  -> submit_discovery_answers        (repeat with get_discovery_questions until none remain)
  -> get_creative_brief
  -> revise_creative_brief           (optional, repeatable)
  -> approve_creative_brief          (requires real user approval)
  -> develop_art_direction
  -> get_selected_direction
  -> create_design_plan_v2
  -> get_design_rules / get_taste_profile   (side calls, no session)
  -> prepare_react_generation        (only for the standalone-generation path)
  -> build_react_project             (only for the standalone-generation path)
  -> review_implementation           (repeat after fixes)
```

`get_art_direction_session` can be called at any time with any current serialized session; it never
mutates.

## Session envelope

Every Phase 2 response (except errors) has this shape:

```ts
interface ArtDirectorMcpResponse {
  session: string; // pass this exact string to the next call, unedited
  state: ArtDirectorSession;
  data?: unknown; // operation-specific, see below
}
```

`state.phase` is one of: `discovery`, `brief-review`, `brief-approved`, `concepts-developed`,
`direction-selected`, `plan-created`.

| Phase                | Reached by                                    | Legal next calls                                                                         |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `discovery`          | `start_art_direction`                         | `get_discovery_questions`, `submit_discovery_answers`, `get_creative_brief` (once ready) |
| `brief-review`       | `get_creative_brief`, `revise_creative_brief` | `revise_creative_brief`, `approve_creative_brief`                                        |
| `brief-approved`     | `approve_creative_brief`                      | `develop_art_direction`, `revise_creative_brief` (revokes approval)                      |
| `concepts-developed` | `develop_art_direction`                       | `get_selected_direction`, `revise_creative_brief` (marks concepts stale)                 |
| `direction-selected` | `get_selected_direction`                      | `create_design_plan_v2`, `revise_creative_brief` (marks direction stale)                 |
| `plan-created`       | `create_design_plan_v2`                       | `prepare_react_generation`, `revise_creative_brief` (marks plan stale)                   |

`get_art_direction_session` is legal from any phase and does not appear in the table above.

## Tool-by-tool

### `start_art_direction`

Args: `prompt` (required, non-empty string), `sessionId` (optional), `requestId` (optional,
idempotency key), `interpretations` (optional evidence), `pageMap` (optional).
Response phase: `discovery`. No `data`.

### `get_discovery_questions`

Args: `session`. Read-only. `data` is `DiscoveryQuestion[]` with `id`, `topic`, `group`, `impact`,
`prompt`, `rationale`, `order`.

### `submit_discovery_answers`

Args: `session`, `requestId` (optional), `answers` (optional array), `interpretations` (optional),
`pageMap` (optional). Answer `mode` is one of `exact`, `preference`, `unknown`, `use-judgment`,
`draft`. Stays in `discovery`, no `data`. High-impact gaps block `get_creative_brief`.

### `get_creative_brief`

Args: `session`, `requestId` (optional). Phase becomes `brief-review`; `data` is the `CreativeBrief`
(versioned content, decision provenance, unresolved information, revisions, digest, approval state).
Never approves. Returns `BRIEF_NOT_READY` if high-impact discovery is incomplete.

### `revise_creative_brief`

Args: `session`, `reason` (required), `requestId` (optional), `decisions`/`interpretations`/
`pageMap` (optional replacements). Returns to `brief-review`. A material revision revokes approval
and marks concepts/direction/plan stale — they cannot be reused past a later phase boundary; they
must be recomputed.

### `approve_creative_brief`

Args: `session`, `approvedBy` (optional string), `requestId` (optional). Phase becomes
`brief-approved`; `data.approval.approvedDigest` binds approval to the exact reviewed brief content.
**Only call this after the user has actually approved in this conversation.**

### `develop_art_direction`

Args: `session`, `requestId` (optional). Requires `brief-approved`. Phase becomes
`concepts-developed`; `data` is a `ConceptDevelopmentArtifact`: candidate array, evaluation array,
recommended candidate ID, selection rationale, approved-brief digest, own digest.

### `get_selected_direction`

Args: `session`, `requestId` (optional). Requires `concepts-developed`. Phase becomes
`direction-selected`; `data` is a `SelectedDirectionArtifact` (candidate, optional evaluation,
rationale, approved-brief digest, concept digest, direction digest). Binds the _recommended_
candidate — the current schema does not accept a caller-chosen alternate ID.

### `create_design_plan_v2`

Args: `session`, `requestId` (optional). Requires `direction-selected`. Phase becomes
`plan-created`; `data` is a `DesignPlanV2Artifact` whose `plan` is the validated Design Plan v2,
bound to the approved-brief and selected-direction digests.

### `get_art_direction_session`

Args: `session` (any current serialized session). Read-only, no phase requirement. Returns
`session`/`state`, no `data`. Tampering (digest, artifact-binding, or shape) returns
`INVALID_SESSION`.

### `prepare_react_generation`

Args: `session` (must be the exact string returned by `create_design_plan_v2`, unmodified). Requires
`plan-created`. Returns the generation context: project ID, plan identity, page map, narratives,
typography/color/composition/navigation/responsive/motion, provenance, protected invariants,
implementation constraints, a plan-derived architecture policy, required source files, quotas,
supported asset types, and the runtime-owned-file denylist. Does not write files.

### `build_react_project`

Args: `session` (exact `plan-created` session), `requestId` (required idempotency key), `files`
(array of `{ path, kind: 'react'|'typescript'|'stylesheet'|'text', content }`, `src/App.tsx` and
`src/styles.css` required), `assets` (optional base64 images, allowlisted media types). Runs the
authored source through validation, secret scanning, immutable materialization, frozen offline
install, production build, and deterministic implementation review including architecture checks.
Rejects runtime-owned files, extra dependencies, scripts, config, absolute/traversal paths,
binaries, over-quota output, credential-shaped content, and outbound network calls. Successful
response includes `workspacePath`, `outputPath`, build diagnostics, review evidence, and
`localDevelopment` (`{ cwd, command: 'pnpm', args: ['run','dev'], host: '127.0.0.1' }`). Same
`requestId` + same source is idempotent; use a new `requestId` after intentionally changing source.

### `get_design_rules`

Args: `category` (defaults `general`; also `website`, `typography`, `composition`, `imagery`,
`motion`). Read-only, no session. Returns principles, anti-patterns, and implementation constraints
for that category plus the active `tasteProfile` identity.

### `get_taste_profile`

No args. Returns the full active `DesignTasteProfile`: principles (with `appliesTo`/`priority`),
anti-patterns (with detection hints, recommendation, default severity, `allowWhen` exceptions),
positive reference notes, selection criteria.

### `review_implementation`

Args: `files` (path/content pairs — descriptive evidence, not read from disk by the server),
optional `visualEvidence` (`screenshots[]` with viewport/location/notes,
`checkedForEmptySpace`/`checkedForMissingMedia` booleans, `visualObservations[]`), optional
`compositionContext` (`expectedSignature`, `recentSignatures`). Returns `status`
(`pass`/`revision_recommended`), `score`, `findings[]` (`rule`, `severity`, `rationale`,
`actionableFix`, plus `message`/`suggestion` aliases), `passedRules`, `passedPrinciples`,
`unresolvedDecisions`, and `policy` (profile id/version). Does not inspect screenshot pixels;
evidence fields only prove a check happened.

## Error codes (Phase 2 operations)

`INVALID_SESSION`, `ILLEGAL_TRANSITION`, `BRIEF_NOT_READY`, `BRIEF_NOT_APPROVED`,
`STALE_CONCEPTS`, `STALE_SELECTED_DIRECTION`, `SERVICE_OUTPUT_INVALID`, `REQUEST_ID_CONFLICT`.

Error shape:

```json
{
  "error": {
    "code": "ILLEGAL_TRANSITION",
    "message": "develop_art_direction is not allowed while the session is in \"discovery\".",
    "action": "Complete the current phase first. Allowed phases: brief-approved.",
    "details": { "phase": "discovery", "allowed": ["brief-approved"] }
  }
}
```

Always follow the returned `action`. Never hand-repair a serialized session; return to the last
trusted session, complete the required transition, or recompute the stale artifact instead.

## Phase 1 compatibility tools (not part of the Phase 2 sequence)

`create_design_plan`, `get_design_rules`, `get_taste_profile`, and `review_implementation` are the
four Phase 1 tools; only `get_design_rules`, `get_taste_profile`, and `review_implementation` are
used by this skill (in steps 11 and 16–17). `create_design_plan` is a lower-level, no-discovery,
no-approval planning API — `/art-direct` uses `create_design_plan_v2` instead because it needs
provenance and approval gates. Do not substitute `create_design_plan` for the Phase 2 flow.
