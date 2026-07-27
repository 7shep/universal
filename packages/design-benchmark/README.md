# Design benchmark

Offline tooling for the versioned Universal design-quality benchmark.

The package compares an `unguided` generation with a `universal-guided` generation for each
brief. Source evidence is deterministic and reproducible. Criteria that require visual judgment
remain `not_evaluable` until rendered evidence is attached; the source collector does not use a
live preview or network access.

Benchmark definitions live in `../../benchmarks/design-quality/v1`.

`executeBenchmarkPair` is the offline execution boundary. Callers inject workspace, generation,
and required-check adapters; the runner creates one isolated workspace per arm, fixes identical
starter/brief bytes and budgets, exposes Universal instructions/tools only to the guided arm,
and returns auditable check results with exit statuses and SHA-256 output digests.
