# Design Quality Benchmark v1

This directory is the immutable input corpus for design-quality benchmark version
`1.0.0`. It is intentionally data-only so runners can consume it without network
access or a live preview.

## Contents

- `suite.json` identifies the twelve briefs, the two experiment arms, evidence
  policy, and blind comparison protocol.
- `rubric.json` defines the versioned scoring dimensions and aggregation rules.
- `briefs/*.json` contains one self-contained product brief per benchmark case.

## Experiment arms

Each brief is executed twice from the same clean starter state:

- `unguided`: the runner copies only the starter fixture and verbatim brief into
  an isolated workspace. It must not copy or expose repository `AGENTS.md` files,
  Universal skills, design plans, design rules, or implementation reviews. The
  runner supplies only the neutral build/test instructions shared by both arms.
- `universal_guided`: the implementation agent receives the same starter fixture,
  verbatim brief, and neutral build/test instructions, then must use Universal's
  design-plan, design-rules, and implementation-review workflow.

The arm label must never be exposed to scorers. Runners assign opaque artifact
labels (`candidate_a` and `candidate_b`) using a recorded deterministic swap.

## Evidence states

Version 1 is source-only. Evidence is a normalized, lexicographically ordered
snapshot of allowed source files plus deterministic command results. No live
preview, screenshot, browser, network request, or remote asset is required.

Dimensions whose `evidence_kind` is `rendered` are recorded as:

```json
{
  "status": "not_evaluable",
  "score": null,
  "reason": "rendered_evidence_unavailable"
}
```

They are excluded from totals and must not be inferred from CSS, component names,
or prose. A later benchmark version may supply rendered evidence and activate
those dimensions without changing historical v1 results.

## Versioning

Changes that alter prompts, requirements, rubric wording, weights, evidence
policy, or aggregation semantics require a new versioned directory. Typo-only
changes still require updating `content_revision` in `suite.json` so reports can
identify the exact corpus.
