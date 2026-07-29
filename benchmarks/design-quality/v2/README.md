# Universal Design Benchmark v2

This directory is the immutable input and approved-evidence corpus for the permanent Phase 3 design
benchmark. It deliberately covers eight different product and content archetypes rather than one
showcase site.

## Evidence model

Deterministic checks cover Design Plan v2 fidelity, responsive mechanics, route/content completeness,
accessibility mechanics, repository organization, build success, and runtime-policy compliance.
Visual originality is a separate subjective judgment. A report must never infer subjective quality
from source names, CSS tokens, or DOM strings.

Every run records the suite input digest, suite version, brief ID, arm, immutable revision ID,
criterion evidence, and rationale. The report's aggregate and regression scores are calculated only
from deterministic criteria; subjective visual-originality evidence remains separately visible and
can be `not-evaluated`. Paired comparisons use the same brief bytes and budgets.
Historical comparisons require an identical suite version and input digest.

## Execute

Run the package tests and benchmark checks:

```bash
pnpm --filter @universal/design-benchmark test
```

A harness loads this directory with `loadPermanentBenchmark()`, executes each brief in independent
workspaces, records all eight criterion results, and writes a structured report with
`createPermanentBenchmarkReport()`. Compare a current report with an approved report using
`comparePermanentBenchmarkReports()`.

## Add a brief

1. Create a new versioned directory if the case set, wording, constraints, scoring, or evidence
   semantics change.
2. Add a canonical JSON file beneath `briefs/`.
3. Add its path to `suite.json` and increment `contentRevision`.
4. Keep categories materially different and update validation/tests if a new category is intentional.
5. Capture both successful and failed representative evidence without deleting historical fixtures.

## Score and review

Each criterion records `passed`, `failed`, or `not-evaluated`, a numeric score only when evidence
supports it, stable evidence references, and a concise rationale. Human reviewers score visual
originality from rendered desktop/mobile evidence; this is not machine verification of visual
quality. Machine checks remain independently reviewable.

## Update an intentional baseline

Baseline changes require maintainer review. Preserve the prior report, add the replacement evidence,
record why the changed result is intentional, and update the approved baseline reference. Never edit
an old input directory in place; create a new suite version when inputs or scoring semantics change.

## Detect regressions

Only compare reports with matching suite versions and input digests. The regression report flags a
score drop beyond the configured threshold per brief and arm. Deterministic failures remain visible
even when a subjective score is absent.

createPermanentBenchmarkReport() preserves the v2 structured report contract while adding totals by criterion, outcome, and brief. summarizePermanentBenchmarkReport() and summarizePermanentRegressionReport() produce deterministic companion text; regression entries retain the baseline and current evidence paths for every changed result.
