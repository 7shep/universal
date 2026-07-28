# Design benchmark

Offline tooling for the versioned Universal design-quality benchmark.

The package compares an `unguided` generation with a `universal-guided` generation for each
brief. Source evidence is deterministic and reproducible. Criteria that require visual judgment
remain `not_evaluable` until rendered evidence is attached; the source collector does not use a
live preview or network access.

Benchmark definitions live in `../../benchmarks/design-quality/v1`.

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
