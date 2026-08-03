# Live Generation Provider: turning an approved Design Plan v2 into a real React project

Date: 2026-08-02
Status: Approved for planning
Revision: 2 — replaces an API-key-based design. See "Why this was rewritten".

## Problem

Studio can produce a real Design Plan v2 from a user prompt, and the runtime can generate, install,
build, review, and serve a project. Nothing in the codebase turns the plan into matching React.

`DeterministicReactProvider` (`packages/generation/src/fake-provider.ts`) validates only that the
page map is non-empty, then returns a hardcoded list of fixture files (`fake-app.tsx.txt`,
`fake-product-page.tsx.txt`, and nine others). It never reads the plan's routes. A prompt for a
membership site produces a mechanical-keyboard sample site, and the deterministic implementation
review correctly rejects it:

```
page-map-coverage: Approved routes are missing: /retreats/outer-hebrides.
ARCH_ROUTE_PAGE_COVERAGE: Every approved route must map to an imported page component.
```

`createConfiguredGenerator` (`packages/local-runtime/src/provider-config.ts:24`) defaults to that
provider, and its live path throws `Live provider ... is not installed` because `cli.ts` passes no
`LiveProviderFactory`. The seam exists; nothing fills it.

## Why this was rewritten

Revision 1 designed a provider around the Anthropic SDK and a metered `UNIVERSAL_PROVIDER_API_KEY`.
That contradicted a hard project constraint: generation must run on an existing subscription and
must not introduce per-token billing.

Both agent CLIs are installed and already authenticated on the target machine — Claude Code 2.1.220
and codex-cli 0.146.0. Driving one of them as a subprocess uses the subscription the operator
already pays for. This is also strictly simpler: no SDK dependency, and therefore none of revision
1's package-boundary problem.

**This is not unmetered.** Generation consumes the operator's existing subscription usage, the same
budget as an interactive session. It introduces no new billing relationship.

## Goals

- A prompt produces a generated site whose pages, routes, and visual system match the approved plan.
- The generated project passes the deterministic implementation review, so Preview will serve it.
- Generation runs on an existing subscription. No API key, no per-token billing.
- The deterministic provider remains the default: `pnpm dev` still needs no credentials.

## Non-goals

- No SDK integration and no API-key path.
- No changes to `ReactGenerator`, `validateProviderProject`, or the review gate.
- No runtime orchestration changes. Repair happens inside the provider, not `runtime-service.ts`.
- No per-page generation. One call produces the whole project.
- No new provider-selection UI. Activation is by environment variable.

## Approach

The provider spawns a locally installed, already-authenticated agent CLI as a child process, passes
the design plan as a schema-constrained prompt, parses the returned file set, self-checks it against
the review rules, and makes at most one repair call.

**A subprocess rather than an SDK** because it is the only route that uses a subscription instead of
a metered key. It also removes the dependency entirely, and the pattern is already proven in this
repository: `art-director-session.ts` spawns design-mcp over stdio and the runtime supervises build
subprocesses in `process-supervisor.ts`.

**Two CLI adapters behind one seam.** The invocation differences are small enough that a shared core
is worth it, and the seam (`LiveProviderFactory`) already exists.

| | Claude Code | Codex |
|---|---|---|
| Headless entry | `claude -p` | `codex exec` |
| Schema constraint | `--output-format json` | `--output-schema <FILE>` |
| Result capture | stdout JSON envelope | `-o <FILE>` final message |
| Constraint injection | `--append-system-prompt` | prompt body |
| Model selection | `--model` | `-m` |
| Isolation | `--permission-mode` | `-s read-only`, `-C`, `--skip-git-repo-check` |

Everything except argv construction and result capture is shared.

**One call rather than per-page** because cross-page consistency (shared components, tokens,
navigation) is free when the model sees the whole plan at once, and a single failure point means a
single retry path. Per-page fan-out scales better but drifts stylistically and needs orchestration
this project does not otherwise require.

**Self-check inside the provider rather than at the review gate** because the review runs after
dependency install and a production build — roughly thirty seconds before a missing route is
discovered. The review's checks are cheap string and regex tests, so the provider can run them on
its own output in milliseconds.

## Architecture

No new package. Revision 1 isolated the provider because `@anthropic-ai/sdk` would have been inlined
into design-mcp's published bundle; with no dependency to inline, that reason is gone. The new
modules sit in `packages/local-runtime/src/`, beside the other code that spawns and supervises
subprocesses.

### New: `packages/local-runtime/src/cli-generation/`

| Module | Responsibility |
|---|---|
| `prompt.ts` | Pure function: `ProjectGenerationRequest` → system prompt + user message. No I/O. |
| `self-check.ts` | Pure function: files + request → list of gaps, using the review's six predicates. |
| `provider.ts` | Orchestrates: build prompt → invoke adapter → parse → self-check → one repair → return. |
| `adapter-claude-code.ts` | argv for `claude -p`, parses the stdout JSON envelope. |
| `adapter-codex.ts` | argv for `codex exec`, writes the schema file, reads `-o` output file. |

The adapter interface is deliberately tiny — everything else is shared:

```ts
interface CliAdapter {
  readonly id: 'claude-code' | 'codex';
  readonly command: string;                       // for the availability probe
  run(input: { system: string; user: string; schema: object; signal: AbortSignal })
    : Promise<string>;                            // returns the raw JSON payload
}
```

### Changed: `packages/local-runtime/src/provider-config.ts`

Revision 1 listed this file as unchanged; that was wrong. Its live path requires both
`UNIVERSAL_PROVIDER_API_KEY` and `UNIVERSAL_PROVIDER_MODEL` and throws otherwise
(`provider-config.ts:33-40`). A subscription-backed provider has no API key, so the credential
requirement becomes conditional on the selected provider:

- `deterministic` (default) — unchanged.
- `claude-code` / `codex` — no API key required. `UNIVERSAL_PROVIDER_MODEL` stays optional and is
  passed through to `--model` / `-m` when set.
- Any other id — unchanged: `Live provider ... is not installed`.

Because there is no secret, the `secrets` array passed to `ReactGenerator` is empty for these
providers. Redaction still applies to anything a future provider adds.

### Changed: `packages/local-runtime/src/cli.ts`

Passes the factory into `createConfiguredGenerator(process.env, cliProviderFactory)`, and reports the
resolved provider in the existing startup JSON line alongside `artDirector`.

### Availability probe

A selected CLI that is not installed must fail at startup with a clear message, not mid-generation
with a spawn error. `cli.ts` probes the adapter's `command` before constructing the generator,
following the same startup-probe pattern used for the art director bridge, and reports the result on
the startup line.

### Unchanged

`ReactGenerator`, `validateProviderProject`, `review.ts`, `fake-provider.ts`, and the rest of
`provider-config.ts`. `DeterministicReactProvider` remains the default, so every existing test runs
with no credentials, no network, and no CLI.

## Data flow

```
ProjectGenerationRequest (plan + GenerationContext)
  -> buildPrompt(request)              pure, deterministic
  -> adapter.run({ system, user, schema, signal })   spawns the CLI
  -> parse JSON                        -> RawGeneratedProject shape
  -> selfCheck(files, request)         the six review predicates
  -> on gaps: ONE repair invocation naming them
  -> return -> ReactGenerator.validateProviderProject -> runtime
```

### Output schema

Mirrors `RawGeneratedProject`: `{ files: [{ path, content, kind }] }`, `kind` an enum of
`react | typescript | stylesheet | text`, `additionalProperties: false`, all fields required. Both
adapters constrain against the same schema object — Claude Code via `--output-format json` plus an
explicit schema in the prompt, Codex via `--output-schema`.

Size limits are not expressed in the schema. They stay where they already are — `validateProviderProject`
and the workspace quotas — and a violation surfaces as an ordinary validation failure.

### Generation scope

The model writes `src/**` only. `package.json`, `vite.config.ts`, `tsconfig*.json`, and `index.html`
come from the checked-in template at materialization; the deterministic provider writes only `src/`
files and the live provider matches. `src/main.tsx` is the entrypoint and must be present.

**The CLI must not write to disk itself.** Both tools have file-editing capability, but
materialization is the runtime's job and revisions are immutable. The adapters run with filesystem
access restricted (`--permission-mode` for Claude Code, `-s read-only` for Codex) and the file set is
returned as JSON.

### Prompt contents

The plan as requirements, not suggestions: `pageMap` routes, `pageNarratives`, `typography`,
`colors`, `composition`, `navigation`, `responsiveTransformations`, `motion`, plus the plan's
`prohibitedPatterns`, `protectedInvariants`, and `implementationConstraints`.

The six review rules are stated as hard constraints, because two are traps a model walks into
unprompted:

- **No absolute URLs of any kind.** `network-denial` (`review.ts:71-77`) rejects `https?://` anywhere
  in source, so stock imagery, font CDNs, and analytics snippets all fail the build.
- **The prohibited-pattern check is textual.** `review.ts:57-64` matches the literal words
  `glassmorphism`, `bento`, `fake scarcity`, `gamer neon`, `black-and-gold`, and `cards inside cards`
  — a code comment mentioning one fails the build.

Also stated: every approved route reachable from `App.tsx`, `<nav>` / `<main>` / `<h1>` present,
`:focus-visible` styled, and a `prefers-reduced-motion` block.

### Self-check

Runs the same six predicates as `review.ts` against the concatenated source and CSS: route coverage,
semantic landmarks, visible focus, reduced motion, prohibited patterns, network denial.

On a gap, one repair invocation carries the previous output plus a precise list of what is missing
(for example, `Approved route /retreats/outer-hebrides has no page component`). One attempt only.

**If the repair still fails, the provider returns the flawed output** and lets the review gate reject
it. The provider must never claim success the review would refuse; its purpose is to make the common
failure cheap, not to become a second authority on correctness.

## Error handling

The `ProviderFailureCode` union is exactly `authentication | rate-limit | timeout | cancelled |
malformed-output | unavailable | internal` (`packages/generation/src/contracts.ts:112-119`). There is
no generic fallback member, so every failure maps onto one of these seven.

| Failure | Code |
|---|---|
| CLI not installed, or spawn failed | `unavailable` |
| CLI exited reporting a login/auth problem | `authentication` |
| CLI exited reporting subscription usage limits | `rate-limit` |
| Generation exceeded the host timeout | `timeout` |
| `AbortSignal` fired (`generate(request, signal)`) | `cancelled` |
| Output not valid JSON, or fails the schema | `malformed-output` |
| Any other non-zero exit | `internal` |

Distinguishing `authentication` and `rate-limit` requires matching CLI stderr text, which is not a
stable contract. The implementation should match loosely and fall back to `internal` rather than
guess, and the message should carry the CLI's own stderr so the operator sees the real cause.

Subprocess lifecycle follows the lessons already paid for in this repository: child stderr is
inherited rather than piped into an undrained buffer, and the child is terminated when the abort
signal fires so a cancelled generation cannot orphan a process.

## Testing

Three of the five modules are pure, so most coverage needs no CLI and no subscription usage.

### Prompt assembly (`prompt.ts`)

Assert routes, typography, colors, and each of `prohibitedPatterns`, `protectedInvariants`, and
`implementationConstraints` appear in the rendered prompt. Catches the silent failure where a plan
field is added upstream and the provider ignores it.

### Self-check predicates (`self-check.ts`)

The highest-value tests, one case per rule:

| Case | Expected |
|---|---|
| Approved route with no matching component | gap reported, naming the route |
| Missing `<nav>` / `<main>` / `<h1>` | gap reported |
| CSS without `:focus-visible` | gap reported |
| CSS without `prefers-reduced-motion` | gap reported |
| Banned word in a code comment | gap reported |
| `https://` image URL in source | gap reported |
| Fully compliant project | no gaps |

### Provider orchestration, with a stub adapter

The `CliAdapter` interface exists so tests never spawn a process:

- Valid payload: correct `RawGeneratedProject`, **exactly one** adapter invocation.
- Payload missing a route: **exactly two** invocations, the second carrying the gap text; repaired
  result returned.
- Repair still failing: flawed output returned, no third invocation, no success claim.
- Adapter throwing spawn/auth/timeout/abort errors: correct `ProviderFailureCode` for each.

The exactly-two-invocations assertion matters most: an unbounded repair loop against a metered
subscription is the expensive failure mode.

### Adapter argv construction

Assert each adapter builds the expected argv without executing it — that Claude Code gets `-p`,
`--output-format json`, and `--append-system-prompt`; that Codex gets `exec`, `--output-schema`, and
`-o`; and that both pass the isolation flags. Pure string assembly, no subprocess.

### Manual verification

A real generation needs an authenticated CLI and consumes subscription usage, so it is an opt-in
manual smoke test. It is also the only test that answers the question that matters: does a real model,
given a real plan, produce a site that passes review on the first attempt?

## Open questions for implementation

1. **First-pass review success rate is unknown.** If real runs fail review often even after the
   repair invocation, the response is to strengthen the prompt's constraint section rather than raise
   the repair limit — repeated repairs multiply subscription usage without addressing why the first
   output was wrong.
2. **Generation latency is unmeasured.** A whole-project generation may take minutes. The existing
   bridge timeout is 60s (`art-director-bridge.ts:163`); the CLI provider needs its own, larger
   budget, and the right value is not knowable until the first real runs.

## Follow-on work

1. Live-updating preview: render pipeline phases and swap the frame from `/api/v1/events`.
2. Unified surface: embed Preview inside Studio, revisiting the ADR 0001 origin separation.
3. Chat-driven iteration: a chat bar issuing revisions against an existing project.
