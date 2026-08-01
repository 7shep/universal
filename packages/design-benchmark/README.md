# Design benchmark

Offline tooling for the versioned Universal design-quality benchmark.

The package compares an `unguided` generation with a `universal-guided` generation for each
brief. Source evidence is deterministic and reproducible. Criteria that require visual judgment
remain `not_evaluable` until rendered evidence is attached; the source collector does not use a
live preview or network access.

Historical source-only definitions live in `../../benchmarks/design-quality/v1`. The permanent
eight-archetype Phase 3 corpus and approved evidence live in `../../benchmarks/design-quality/v2`;
its versioned input digest enables repeatable paired and historical comparisons.

`executeBenchmarkPair` takes trusted workspace, executor, and required-check providers. Injection
is a provider boundary, not a sandbox. Each provider supplies a versioned isolation attestation,
and every execution record reports the required, present, and missing capabilities. A result is
release-comparable only when all suite-required capabilities are attested; generic injected
providers and the included local backends honestly remain unverified for capabilities they do not
enforce.

The runner creates two distinct workspace roots/backends, requires a fresh executor per arm, fixes
identical starter and brief bytes, exposes Universal instructions/tools only to the guided arm, and
uses the suite's token, execution-time, and termination-grace budgets. Executors return a mandatory
terminate-and-join handle. On timeout the runner aborts, requests termination, and waits for `join()`.
A process that does not settle within the termination grace produces `RunnerIsolationFailure`; its
workspace is quarantined and is never released for reuse.

`createLocalFilesystemWorkspaceFactory` uses `mkdtemp` beneath an explicit owned realpath, rejects
portable-path aliases and symlink escapes through its capability I/O, and leaves quarantined roots
with a marker. It does not confine arbitrary process filesystem access. The optional child-process
executor uses an absolute command, `shell: false`, an exact non-inherited environment, the workspace
as `cwd`, hard termination, and close-event joining. It attests separate-process lifecycle control,
not network, host, filesystem, or tool sandboxing.

## Phase 2 art-direction preflight

`evaluateArtDirectionBenchmark()` evaluates serialized workflow evidence before implementation scoring. It reports six independent pass/fail dimensions: discovery coverage; no silent high-impact assumptions; concept differentiation; brief fit; generic-pattern resistance; and approval/provenance integrity. This preflight is deterministic and does not infer rendered visual quality.

## Phase 3 rendered benchmark

`src/phase3.ts` extends the six Phase 2 workflow dimensions with generated-project validity, locked deterministic build, page-map coverage, selected-direction fidelity, typography hierarchy, composition differentiation, responsive intent, accessibility essentials, reduced motion, prohibited patterns, preview isolation, and last-known-good behavior.

A trusted render harness supplies canonical desktop/mobile observations plus lowercase SHA-256 screenshot digests. The collector sorts and validates those records. Structural, runtime, and security dimensions are machine evidence. Selected-direction fidelity and composition differentiation require an identified human review with rationale; the benchmark does not infer subjective quality from source or DOM strings.

Run it offline with:

```bash
pnpm --filter @universal/design-benchmark test
```

The Phase 3 test fixture includes one independent negative mutation for every dimension.

## Permanent v2 corpus

`loadPermanentBenchmark()` loads and digests the immutable eight-archetype v2 corpus. Reports retain
deterministic and subjective evidence as separate criterion records. Paired or historical comparison
requires the same suite version and exact input digest. See
`../../benchmarks/design-quality/v2/README.md` for adding briefs, execution, scoring, intentional
baseline updates, and regression policy. Reports expose additive totals by criterion, outcome, and brief; use
summarizePermanentBenchmarkReport() and summarizePermanentRegressionReport() for stable text
companions, including regression evidence paths.
