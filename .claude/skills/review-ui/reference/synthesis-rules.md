# Synthesis and deduplication rules

Applied after all critic passes (see [critic-rubrics.md](critic-rubrics.md)) return findings
shaped per [finding-schema.md](finding-schema.md).

## Deduplication

Merge two findings only when both are true:

1. Same underlying issue (not just the same category — "missing focus state" and "low contrast"
   are both `accessibility` but are not the same issue).
2. Same target (same file/component/selector and, where relevant, the same viewport).

When merging:

- Keep one finding record with the higher/most specific severity and confidence of the two.
- Populate `supporting_critics` with every critic that independently raised it — never collapse
  this into a single unattributed finding. Provenance survives the merge.
- Combine `evidence` from both if they cite different concrete evidence (e.g. one cites source,
  the other cites a screenshot) — more evidence types raise confidence, not the finding count.

Do not merge a `deterministic` finding into a `judgment` finding or vice versa — keep them
distinct even if they touch the same location, and note the relationship in each one's
rationale instead.

## Conflict and disagreement

When two critics reach opposite recommendations for the same target (e.g. one wants more motion
for affordance, another flags existing motion as excessive), do not average or silently pick a
side:

1. Keep both as a single finding entry with `dissenting_critics` populated.
2. State both positions and their supporting rationale in the write-up.
3. Do not convert this into a deterministic claim — flag it explicitly as requiring human
   judgment/decision, and say so in the "Critic agreement and disagreement" report section.

## Ranking

Order the synthesized list by, in priority: severity → user impact → confidence → repair cost
(cheaper first within a tier) → alignment with the selected direction. Evidence quality outranks
critic count: a single `high`-confidence, `source`+`mcp`-backed finding ranks above three
`low`-confidence `inference`-only findings even if three critics raised the latter.

## Evidence labeling

Every finding's `evidence` field must be tagged with its type: `source`, `screenshot`, `mcp`, or
`inference` (reasoned from patterns without direct observation, e.g. inferring hover behavior
from a `:hover` rule without seeing it rendered). Never present an `inference` as if it were a
`screenshot` observation. When responsive/motion/hover/focus/runtime behavior could not be
directly observed, say so explicitly rather than omitting the caveat.

## What synthesis must not do

- Must not upgrade a `judgment` classification to `deterministic` just because multiple critics
  agree — subjective consensus is still subjective; note the agreement, keep the classification.
- Must not discard a material disagreement to present a cleaner report — retain it.
- Must not claim pixel-level visual inspection when the only evidence is source or a described
  (not pixel-analyzed) screenshot location.
- Must not silently drop a finding from a critic that failed or timed out elsewhere — a failed
  critic loses its own findings, not another critic's.
