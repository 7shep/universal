# Universal glossary

These definitions describe the contracts implemented in the current repository. Follow the linked
types and technical guides for complete schemas.

## Art Director session

The complete, versioned workflow state passed between Phase 2 MCP operations. It contains the
discovery session, current phase, request history, and any concept, selected-direction, or Design
Plan artifacts. Each operation returns a newly serialized complete session; callers pass it
unchanged to the next operation. See
[`ArtDirectorSession`](../packages/design-mcp/src/art-director.ts) and the
[MCP tool reference](MCP_REFERENCE.md#session-handoff-and-response-envelope).

## Discovery decision

A normalized design or product choice learned during discovery, including its topic, value,
source, disposition, evidence, revision, and whether confirmation is required. A decision may be
explicitly supplied, preferred, delegated, drafted, or assumed. See
[`DecisionProvenance`](../packages/design-engine/src/discovery-contracts.ts).

## Creative brief

The versioned, digest-bearing statement of the project's purpose, audience, page map, content,
visual constraints, references, preferences, and unresolved information. It is assembled from
discovery state and must be explicitly approved before concept development. See
[`CreativeBrief`](../packages/design-engine/src/discovery-contracts.ts).

## Approval

The recorded user authorization for one exact creative-brief digest. Approval includes its status,
time, actor, and `approvedDigest`; changing high-impact brief content revokes that authorization.
Approval is a workflow gate, not a general endorsement of future revisions.

## Concept candidate

One deliberately differentiated creative direction produced from an approved brief. A candidate
describes a concept spine, emotional objective, composition, typography, color, imagery, motion,
and other direction dimensions before source generation. See
[`ConceptCandidate`](../packages/design-engine/src/concept-director-contracts.ts).

## Selected direction

The policy-owned choice of one concept candidate, including scoring, rationale, unresolved
dependencies, and bindings to the approved brief. The selection is an input to Design Plan v2; it
is not generated React source. See
[`SelectedDirectionEvaluation`](../packages/design-engine/src/design-plan-v2-contracts.ts).

## Design Plan v2

The validated, versioned implementation direction compiled from an approved creative brief and
selected direction. It records page narrative, composition, section intentions, typography,
color, imagery, responsive transformations, motion, provenance, invariants, assumptions, and
prohibited patterns. See
[`DesignPlanV2`](../packages/design-engine/src/design-plan-v2-contracts.ts) and the
[downstream API](DOWNSTREAM_API.md#compile-and-validate-design-plan-v2).

## Provenance

Structured evidence of where a decision came from and how it was authorized. Universal
distinguishes user decisions, supplied evidence, approved assumptions, and Universal
recommendations, then links plan values to provenance IDs. Provenance makes a decision traceable;
it does not by itself make the decision valid.

## Digest binding

A content-integrity relationship in which an artifact records the digest of the exact upstream
artifact it was created from. For example, approval binds to a creative-brief digest, and a
selected direction binds to that approved brief. A mismatch prevents an outdated or modified
artifact from crossing the next workflow boundary.

## Stale artifact

A previously valid concept, selected direction, plan, generation request, or runtime descriptor
whose upstream identity, version, or digest no longer matches current state. Stale artifacts are
retained for explanation or history but cannot be used as current authorization. Revising an
approved high-impact decision is a common cause.

## Protected invariant

A high-impact page, navigation, hero, brand, or content requirement that implementation and later
revision must preserve. Each invariant includes its rationale and provenance links. Example:
“Keep the archive's chronological index available on every collection page.” See
[`ProtectedInvariant`](../packages/design-engine/src/design-plan-v2-contracts.ts).

## Composition signature

A compact structural identity used to preserve a selected layout and detect repetition. The
single-page signature records hero, navigation, section sequence, and preset; the multi-page
contracts also record routes, reading order, section patterns, slots, and responsive
transformations. Color-only changes do not make a v2 structure distinct. See the
[composition-library guide](../packages/composition-library/README.md#signatures-and-history).

## Design rule

A deterministic constraint or recommendation used during planning or review. Rules can address
composition, accessibility, responsive behavior, motion, typography, or implementation evidence.
A rule is narrower than the complete taste policy and should have a stable identifier when it
produces findings.

## Taste policy

The versioned collection of design principles, anti-patterns, exception requirements, and
selection criteria used to guide plans and implementation review. The active policy is owned by
[`@universal/design-taste`](../packages/design-taste/src/index.ts); it is not an arbitrary style
preset.

## Review finding

One structured implementation-review result containing severity, a stable rule ID, rationale, and
an actionable fix. Findings may recommend revision even when a project builds successfully. See
the [design-linter guide](../packages/design-linter/README.md#results-and-severity).

## Source evidence

The React, CSS, or other submitted implementation text that a deterministic review can inspect.
Source evidence can reveal patterns and contract mismatches, but it cannot prove final layout,
loading, focus rendering, or screenshot appearance.

## Visual evidence

Structured desktop or mobile screenshot references and observations supplied to a review,
including whether empty space and missing media were checked. In the current design-linter API,
visual evidence records human or trusted-workflow observations; the linter does not inspect image
pixels. See [`VisualEvidence`](../packages/design-linter/src/index.ts).
