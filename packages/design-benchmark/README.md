# Design benchmark

Offline tooling for the versioned Universal design-quality benchmark.

The package compares an `unguided` generation with a `universal-guided` generation for each
brief. Source evidence is deterministic and reproducible. Criteria that require visual judgment
remain `not_evaluable` until rendered evidence is attached; the source collector does not use a
live preview or network access.

Benchmark definitions live in `../../benchmarks/design-quality/v1`.

`executeBenchmarkPair` is the offline execution boundary. The checked-in suite supplies the
mandatory checks and token/time budget. Callers inject a capability-scoped workspace factory,
a trusted executor factory, and required-check adapters. The runner creates and releases two
verified-distinct workspace roots/backends, requires a fresh executor per arm, fixes identical
starter/brief bytes, exposes Universal instructions/tools only to the guided request, enforces
abortable time and token limits, finalizes every executor, and returns actual token usage plus
auditable check exit statuses and SHA-256 output digests.
