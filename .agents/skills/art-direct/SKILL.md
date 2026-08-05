---
name: art-direct
description: Use when a user explicitly runs /art-direct for a new or substantially redesigned landing page, dashboard, portfolio, or React interface. Not for narrow visual tweaks or non-visual changes; never invoke automatically.
---

# /art-direct

Orchestrates Universal's Phase 2 Art Director MCP workflow (`design-mcp`) end to end: audit,
reference inspection, discovery, creative brief, direction selection, Design Plan v2,
implementation, and a design-quality review loop. This skill is the conductor — the MCP tools are
the source of design intelligence. Never reimplement discovery policy, concept evaluation, taste
rules, or plan compilation in prose; call the tool.

`$ARGUMENTS` carries the design request: scope (new build vs. redesign), route(s) affected,
constraints, any reference notes/images, and whether generation (`build_react_project`) or in-app
implementation is wanted. If `$ARGUMENTS` is empty, ask the user for the request before starting —
do not invent one.

Full MCP request/response shapes, phases, and error codes are in
[`references/mcp-workflow.md`](references/mcp-workflow.md) — read it before phase 3 if this is your
first run, or whenever a tool call is rejected. This file stays focused on sequencing and gates.

## Hard rules

- **Never fabricate approval.** `approve_creative_brief` and direction selection require a real
  decision from the user in this conversation. If the user is unavailable or the request explicitly
  authorizes autonomous choice, state that assumption plainly in the final report — do not silently
  invent a "yes."
- **Never bypass a state-machine or approval failure.** An `ILLEGAL_TRANSITION`,
  `BRIEF_NOT_APPROVED`, `STALE_CONCEPTS`, `STALE_SELECTED_DIRECTION`, or `INVALID_SESSION` error is
  an answer, not an obstacle to route around. Follow the returned `action`.
- **Never hand-author a session string.** Always pass forward the exact `session` string the
  previous tool call returned. Do not edit it, truncate it, or reconstruct one from memory.
- **Never commit, push, deploy, or open a PR from within this skill** unless `$ARGUMENTS` explicitly
  asks for that. This skill's job ends at reporting evidence.
- **Never imitate a named company's protected visual identity**, even when a reference clearly
  evokes one. Extract transferable characteristics (palette relationships, type contrast, spacing
  rhythm, motion tone) instead of copying a specific brand's mark, exact palette, or layout.
- If a required MCP tool is unavailable or fails unexpectedly, disclose that limitation in the
  final report rather than silently substituting guesswork.

## Workflow

### 1. Audit current project and scope

Read the relevant React, styling, routing, state, and test files for the affected area. Identify:
existing functionality and public APIs that must survive, reusable components/tokens, the design
system already in place, and any unrelated local changes to leave untouched. Determine from
`$ARGUMENTS` whether this is a new build, a redesign of an existing interface, or a scoped
implementation inside an existing app — this decides later choices (`build_react_project` vs.
implementing directly in the repo).

### 2. Inspect references, if any

If `$ARGUMENTS` names or attaches reference images:

- Actually inspect each one. Extract a structured brief: palette (hex/tone relationships), type
  pairing and scale logic, composition/grid pattern, material/surface cues (flat, textured,
  layered), imagery style, interaction/motion tone, and explicit avoidances.
- Note uncertainty honestly — say when a characteristic is ambiguous rather than asserting it.
- Treat every reference as a constraint/inspiration input to discovery and the brief, never as an
  asset to reproduce pixel-for-pixel or a license to imitate a specific brand's identity.
- **If the user mentions a reference but no image was actually inspectable** (missing attachment,
  broken path, inaccessible URL), say so explicitly in this step and in the final report's
  limitations section. Do not proceed as if you saw it.

If there are no references, state that plainly and proceed on the written request alone.

### 3. Start or restore the Art Director session

- **New work:** call `start_art_direction` with the prompt derived from `$ARGUMENTS` (plus any
  `pageMap`/`interpretations` you can responsibly derive from the audit). This returns phase
  `discovery`.
- **Resuming or diagnosing a session the user supplies:** call `get_art_direction_session` first.
  It validates and inspects without mutating. Branch on the result:
  - Valid session → resume at its reported `phase` using the matching step below. Do not restart a
    valid session.
  - `INVALID_SESSION` (tampered/malformed/digest mismatch) → do not attempt manual repair. Tell the
    user the session can't be trusted and offer to start fresh with `start_art_direction`.
  - Session reports a phase earlier than expected, or a later mutation fails with
    `ILLEGAL_TRANSITION` → surface the tool's `action` and `details.allowed` phases verbatim, and
    drive the session through the missing legal transitions rather than skipping them.

Keep the returned `session` string; every later call needs the exact latest one.

### 4. Discovery

Loop `get_discovery_questions` → answer → `submit_discovery_answers` until no high-impact questions
remain. Before asking the user anything, check whether `$ARGUMENTS` or the audit already answers a
question (purpose, audience, page content, brand attributes, etc.) — submit that as an `exact` or
`preference` answer instead of re-asking. Use `unknown` or `use-judgment` modes only when the
information genuinely isn't available and isn't blocking. Submit a `pageMap` when the scope spans
multiple routes.

### 5. Creative brief

Call `get_creative_brief`. Present the full brief to the user in readable form (purpose, audience,
brand attributes, page map, unresolved decisions). This step never approves anything by itself.

### 6. Revise until approved — real approval only

If the user requests changes, call `revise_creative_brief` with `reason` and the specific decision
replacements, then re-present. Repeat until the user is satisfied. Only then call
`approve_creative_brief` with the user's own approval (pass `approvedBy` when you have an
identifier). **Pause here and wait for the user's explicit approval before calling this tool** —
do not infer approval from silence, from a generally positive tone, or from time pressure.

### 7. Develop art directions

Call `develop_art_direction` (requires `brief-approved`). This returns multiple evaluated
candidates plus a recommended one — it does not pick for the user.

### 8. Present differences and get a direction decision

Summarize each candidate's distinguishing thesis, key decisions, and tradeoffs in the recommended
candidate's rationale and the alternatives, in plain language. If the request or contract calls for
a user choice among the candidates, ask for it explicitly and do not proceed silently — the current
MCP contract only exposes `get_selected_direction`, which binds the _recommended_ candidate. If the
user wants a different candidate, say plainly that this MCP surface does not support selecting a
non-recommended candidate today, and confirm with the user whether to proceed with the recommended
direction or stop.

### 9. Record the selected direction

Call `get_selected_direction`. This binds the recommendation to the approved-brief and concept
digests and moves the session to `direction-selected`.

### 10. Create Design Plan v2

Call `create_design_plan_v2`. Treat the returned `plan` as the single visual source of truth for
implementation — typography, color, composition, navigation, responsive and motion direction, and
protected invariants all flow from it. Do not improvise around it.

### 11. Rules and taste guidance

Call `get_design_rules` for the relevant category/categories (`general`, `website`, `typography`,
`composition`, `imagery`, `motion`) and `get_taste_profile`. Use these as implementation guardrails
alongside the plan, not as a substitute for it.

### 12. Prepare generation or implement in the app

- **Standalone generation was requested:** call `prepare_react_generation` (requires the exact
  `plan-created` session), author the allowed source files per its returned contract, then call
  `build_react_project` with a stable `requestId`. Report the returned `localDevelopment` command
  and build/review diagnostics.
- **Implementing inside the existing app was requested (the common case for a redesign):** author
  the React/CSS/TypeScript changes directly in the repository, following the Design Plan v2 and
  design rules. `prepare_react_generation`/`build_react_project` are for the credential-free
  standalone-project generation path — do not force a repo-implementation task through them.

### 13. Preserve what wasn't asked to change

Routing, state management, business logic, accessibility semantics, and public component APIs stay
intact unless `$ARGUMENTS` explicitly asks for those changes. Build real interactions where the
plan or existing interface calls for them; do not regress working behavior into a static mockup.

### 14. Run checks

Run formatting, type checks, targeted/relevant tests, and the production build where the repo
provides them for the touched workspace. Fix compilation errors and material regressions before
moving on.

### 15. Gather visual evidence

Start the app and inspect the affected UI at representative desktop and mobile widths using
whatever tooling is available in this environment. Record what you actually observed — do not
describe a screenshot you didn't take.

### 16. Run the design-quality review

Call `review_implementation` with the final React/CSS source, `visualEvidence` (screenshots/notes
you actually gathered — set `checkedForEmptySpace`/`checkedForMissingMedia` truthfully), and
`compositionContext` (the plan's expected signature) when available.

### 17. Fix and re-review

Fix high-severity findings and practical medium-severity findings. Re-run `review_implementation`
on materially changed React/CSS files. Findings intentionally left unresolved go in the final
report, not silently dropped.

### 18. Report

Produce the final output using the template below. Never claim a tool call, test, build, or visual
check happened if it didn't.

## Final output template

Use these nine sections, in order, in the final report:

1. **Request and scope** — what was asked, route(s)/files affected, generation vs. in-app.
2. **Approved creative brief** — summary, with explicit confirmation of who approved it and how.
3. **Selected direction and rationale** — which candidate, why, and what the alternatives were.
4. **Design-plan summary** — key typography/color/composition/motion decisions from Design Plan v2.
5. **Implementation changes** — files touched and what changed, in brief.
6. **Behavior preserved** — routing, state, accessibility, public APIs confirmed unchanged (or
   explicitly changed per request).
7. **Validation and viewport evidence** — exact commands run, results, and desktop/mobile
   observations actually made.
8. **Implementation-review findings and resolutions** — `review_implementation` results, what was
   fixed, what remains.
9. **Remaining limitations or decisions** — anything skipped, assumed, deferred, or blocked
   (including unresolved reference-inspection or approval-gate cases), stated plainly.
