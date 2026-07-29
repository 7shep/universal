# ADR 0003: Phase 3 quality, acceptance, export, and asset boundaries

- Status: Accepted
- Date: 2026-07-28
- Scope: Phase 3.1 architecture enforcement, Phase 3.2 rendered QA, acceptance/export, assets

## Decision

Universal keeps generated revisions immutable and adds three narrow services around them:

1. Rendered QA builds an exact revision, launches only a loopback preview, captures every approved
   route at the versioned desktop and mobile viewports, records machine findings separately from
   human judgment, and may evaluate one bounded child revision linked to its parent.
2. Acceptance is an explicit user-confirmed metadata operation. Export is a second, separately
   authorized operation that copies an accepted revision beneath configured roots and embeds
   project, revision, Design Plan, review, acceptance, and timestamp provenance.
3. Generated and supplied assets use an explicit validated manifest. Media signatures, extensions,
   dimensions, quotas, SVG contents, paths, collisions, provenance, attribution, and licensing are
   checked before materialization.

The proportional TypeScript architecture analysis remains a deterministic build gate for blocking
findings. Advisory organization findings remain warnings and do not become blocking merely because
the project is small.

## Rendered QA contract

The default evidence viewports are 1440×1000 desktop and 390×844 mobile. Evidence is recorded per
route and viewport with screenshot digest, category, severity, remediation, and machine/human kind.
`PlaywrightRenderedQaCapture` is the trusted, pinned Chromium implementation. It accepts loopback
origins only, aborts outbound requests, disables service workers, emulates reduced motion, captures
focus and layout metrics, stores revision-scoped evidence atomically, and reliably closes browser
contexts. The adapter interface remains available for controlled test doubles.

A revision proposal must name the immutable parent, use a distinct revision ID, change no more than
the configured number of allowlisted source files, rebuild, and recapture all evidence. The
candidate is accepted only when it passes, introduces no route-specific regression, and reduces
errors. No accepted revision is replaced in place.

## Acceptance and export contract

Generation cannot select an export destination. `AcceptanceExportService.accept()` requires an
identified explicit confirmation. `export()` requires a separate confirmation and only accepts one
absolute, unambiguous destination beneath a configured root.

New destinations and existing empty directories are supported. Existing non-empty directories,
unsafe overwrite, traversal, symlink/junction escape, case-folding collisions, and destinations
outside configured roots are rejected. Export stages a complete copy and provenance file, then
renames it atomically. An existing empty directory is temporarily renamed and restored on failure.

## Asset contract and compatibility

The existing `GeneratedAsset` fields remain compatible. Phase 3 adds optional `role`, `provenance`,
`license`, `dimensions`, and `responsiveGroup` fields. Codec output adds an optional versioned
`provenance.transformer` while retaining the supplied/generated source. Old producers remain readable, while new
producers should provide provenance and licensing metadata. Materialization emits
`.universal-assets.json` beside `.universal-manifest.json`.

Supported inputs are local PNG, JPEG, WebP, passive SVG, WOFF/WOFF2, TTF, and OTF files beneath
`src/assets`. Scriptable SVG features, event attributes, remote/data references, media spoofing,
noncanonical base64, traversal, links, and case-folding collisions are rejected. The model does not
gain dependency, download, build-configuration, or runtime-command authority.

The runtime-owned `universal-trusted-asset-codec@1.0.0` decodes and deterministically re-encodes PNG,
JPEG, WebP, TTF, WOFF, and WOFF2 assets. It strips raster metadata and derives fixed 640px and 1280px
variants only for explicit responsive groups; every derived output is revalidated against manifest
quotas and path rules. Passive SVG receives canonical normalization. OTF/CFF is accepted by the
generation schema for compatibility but materialization now rejects it with a migration diagnostic;
producers must supply WOFF2, WOFF, or TTF so no font silently bypasses optimization.

## Security boundary

The immutable materialization/build pipeline and isolated Preview remain security boundaries. The
loopback Vite development server remains developer convenience and is not described as isolated
browser execution.
