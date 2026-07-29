# Local runtime

Trusted local orchestration for immutable generated React revisions, fixed builds, isolated static
Preview origins, deterministic architecture review, rendered QA, explicit acceptance/export, and
safe materialization.

## Phase 3.2 APIs

- `runRenderedQaLifecycle()` builds and captures every approved route at desktop/mobile viewports,
  records machine and human findings separately, evaluates at most one bounded child revision, and
  closes each loopback preview in success and failure paths.
- `runRenderedQaWithPlaywright()` supplies the trusted pinned-Chromium capture engine. It permits
  loopback traffic only, blocks service workers and outbound requests, and atomically stores
  revision-scoped screenshots. Install its browser with `pnpm playwright:install`.
- `AcceptanceExportService.accept()` records explicit acceptance without changing the revision.
- `AcceptanceExportService.export()` performs a separate authorized export beneath configured
  roots, using staging/recovery and embedded `.universal/provenance.json`.
- `RuntimeService.acceptRevision()` and `exportAcceptedRevision()` bind those operations to a
  successfully built, passed-review revision; export roots are runtime configuration, never
  generation input.
- `materializeProject()` validates the controlled asset manifest, runs the versioned trusted
  raster/font codec, derives explicitly requested responsive variants, and writes
  `.universal-assets.json` alongside the immutable project manifest.

The rendered-QA capture adapter remains an injectable seam for tests; production callers use the
concrete Playwright implementation.
Returned Vite development servers are loopback developer convenience, not isolated browser
execution.
