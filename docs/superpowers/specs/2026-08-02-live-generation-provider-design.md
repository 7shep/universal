# Live Generation Provider: turning an approved Design Plan v2 into a real React project

Date: 2026-08-02
Status: Approved for planning

## Problem

Studio can produce a real Design Plan v2 from a user prompt, and the runtime can generate,
install, build, review, and serve a project. Nothing in the codebase turns the plan into matching
React.

`DeterministicReactProvider` (`packages/generation/src/fake-provider.ts`) validates only that the
page map is non-empty and then returns a hardcoded list of fixture files (`fake-app.tsx.txt`,
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

This spec covers the provider only. Live-updating preview, a unified Studio/Preview surface, and
chat-driven iteration remain separate follow-on projects.

## Goals

- A prompt produces a generated site whose pages, routes, and visual system match the approved plan.
- The generated project passes the deterministic implementation review, so Preview will serve it.
- The deterministic provider remains the default: `pnpm dev` still needs no credentials.

## Non-goals

- No changes to `provider-config.ts` logic, `ReactGenerator`, `validateProviderProject`, or the
  review gate.
- No runtime orchestration changes. Repair happens inside the provider, not in `runtime-service.ts`.
- No per-page generation. One structured call produces the whole project (see Approach).
- No new provider-selection UI. Activation is by environment variable, as today.

## Approach

A single streamed, schema-constrained call generates the entire project, followed by a self-check
against the review rules and at most one repair call.

**One call rather than per-page** was chosen because cross-page consistency (shared components,
design tokens, navigation) comes for free when the model sees the whole plan at once, and because a
single failure point means a single retry path. Per-page fan-out scales to larger page maps and
keeps responses small, but pages drift stylistically when each call sees only its own slice, and it
requires orchestration this project does not otherwise need. Deciding per plan size was rejected as
premature: two code paths, a threshold with no usage data behind it, and bugs that appear on only
one path.

**Self-check inside the provider rather than at the review gate** was chosen because the review runs
after dependency install and a production build — roughly thirty seconds of work before a missing
route is discovered. The review's checks are cheap string and regex tests, so the provider can run
them on its own output in milliseconds. A runtime-level repair loop would also catch TypeScript and
build errors, but needs new orchestration and re-runs install and build on every attempt.

## Architecture

### New package: `packages/generation-anthropic`

Name `@universal/generation-anthropic`. Depends on `@anthropic-ai/sdk` and `@universal/generation`.
Exports one symbol:

```ts
export const anthropicProviderFactory: LiveProviderFactory;
// create({ providerId, model, apiKey }) -> ReactGenerationProvider
```

**Import constraint, load-bearing:** this package may be imported only from
`packages/local-runtime/src/cli.ts`, and must never be re-exported from local-runtime's `index.ts`.

`packages/design-mcp` declares `@universal/local-runtime` in `devDependencies` and bundles with
esbuild using `external = Object.keys(dependencies)` (`packages/design-mcp/scripts/bundle.mjs:28`).
Everything reachable from local-runtime's `index.ts` is therefore inlined into design-mcp's
published npm artifact. `@modelcontextprotocol/sdk` escapes this because design-mcp declares it as a
dependency; `@anthropic-ai/sdk` would not, so a re-export would inline the entire Anthropic SDK into
a published package, or trip the undeclared-externals check at `bundle.mjs:47-59`. `cli.ts` is the
runtime's `bin` and is outside the library surface design-mcp imports.

### Provider internals

Three pieces with separate responsibilities:

1. **Prompt assembly** — a pure function from `ProjectGenerationRequest` to the system prompt and
   user message. No I/O, so it is unit-testable directly.
2. **The model call** — `client.messages.stream()` on `claude-opus-5` with `output_config.format`
   set to a JSON schema mirroring `RawGeneratedProject`. Streaming is required rather than optional:
   a whole project is long output and a non-streaming request risks SDK HTTP timeouts. Adaptive
   thinking is on by default on this model.
3. **Self-check and repair** — runs the review's six predicates against the returned files and, on a
   gap, makes exactly one more call naming what is missing.

The SDK client is an optional constructor argument defaulting to a real one, so tests inject a stub.

### Changed: `packages/local-runtime/src/cli.ts`

```ts
const configured = createConfiguredGenerator(process.env, anthropicProviderFactory);
```

That is the entire wiring change. `provider-config.ts:31` already throws when the factory is absent,
so supplying it is the whole activation. Selection and credentials are unchanged:
`UNIVERSAL_GENERATION_PROVIDER` selects the provider, `UNIVERSAL_PROVIDER_API_KEY` and
`UNIVERSAL_PROVIDER_MODEL` supply credentials, and both stay runtime-only.

### Unchanged

`provider-config.ts` logic, `ReactGenerator`, `validateProviderProject`, `review.ts`, and
`DeterministicReactProvider`, which remains the default. Every existing test continues to run
against the deterministic provider with no credentials and no network.

## Data flow

```
ProjectGenerationRequest (plan + GenerationContext)
  -> buildPrompt(request)               pure, deterministic
  -> client.messages.stream(...)        claude-opus-5, output_config.format
  -> structured output                  -> RawGeneratedProject shape
  -> selfCheck(files, request)          the six review predicates
  -> on gaps: ONE repair call naming them
  -> return -> ReactGenerator.validateProviderProject -> runtime
```

### Output schema

Mirrors `RawGeneratedProject`: `{ files: [{ path, content, kind }] }` with `kind` an enum of
`react | typescript | stylesheet | text`, `additionalProperties: false`, all fields required.
Structured outputs do not support `minLength` or `maxLength`, so size limits stay where they already
are — `validateProviderProject` and the workspace quotas — and a violation surfaces as an ordinary
validation failure.

### Generation scope

The model writes `src/**` only. `package.json`, `vite.config.ts`, `tsconfig*.json`, and `index.html`
come from the checked-in template at materialization; the deterministic provider writes only `src/`
files and the live provider matches. `src/main.tsx` is the entrypoint and must be present.

### Prompt contents

The plan is expressed as requirements, not suggestions: `pageMap` routes, `pageNarratives`,
`typography`, `colors`, `composition`, `navigation`, `responsiveTransformations`, `motion`, plus the
plan's `prohibitedPatterns`, `protectedInvariants`, and `implementationConstraints`.

The six review rules are stated as hard constraints, because two of them are traps a model walks
into unprompted:

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

On a gap, one repair call carries the previous output plus a precise list of what is missing (for
example, `Approved route /retreats/outer-hebrides has no page component`). One attempt only.

**If the repair still fails, the provider returns the flawed output** and lets the review gate reject
it. The provider must never claim success the review would refuse; its purpose is to make the common
failure cheap, not to become a second authority on correctness.

## Error handling

| Failure | `ProviderFailureCode` |
|---|---|
| Invalid or missing API key | `authentication` |
| HTTP 429 | `rate-limit` |
| Request timeout | `timeout` |
| `AbortSignal` fired (`generate(request, signal)`) | `cancelled` |
| Malformed JSON or schema mismatch | `malformed-output` |
| HTTP 5xx, overload, connection failure | `unavailable` |
| Anything else | `internal` |

The union is exactly `authentication | rate-limit | timeout | cancelled | malformed-output |
unavailable | internal` (`packages/generation/src/contracts.ts:112-119`) — there is no generic
provider-error member, so every SDK exception must map onto one of these seven.

`ReactGenerator` is constructed as `new ReactGenerator(provider, [apiKey])`
(`provider-config.ts:42`), so the key is redacted from every diagnostic reaching Studio.

## Testing

Three of the four pieces are pure, so most coverage needs no network.

### Prompt assembly

Assert that routes, typography, colors, and each of `prohibitedPatterns`, `protectedInvariants`, and
`implementationConstraints` appear in the rendered prompt. This catches the silent failure where a
plan field is added upstream and the provider ignores it.

### Self-check predicates

The highest-value tests, one case per rule, each a crafted file set:

| Case | Expected |
|---|---|
| Approved route with no matching component | gap reported, naming the route |
| Missing `<nav>` / `<main>` / `<h1>` | gap reported |
| CSS without `:focus-visible` | gap reported |
| CSS without `prefers-reduced-motion` | gap reported |
| Banned word in a code comment | gap reported |
| `https://` image URL in source | gap reported |
| Fully compliant project | no gaps |

### Model call, with an injected stub client

- Valid payload: correct `RawGeneratedProject`, **exactly one** call.
- Payload missing a route: **exactly two** calls, the second carrying the gap text; repaired result
  returned.
- Repair still failing: flawed output returned, no third call, no success claim.
- Stubbed `RateLimitError`, `AuthenticationError`, and abort: correct `ProviderFailureCode`.

The exactly-two-calls assertion is the most important one here — an unbounded repair loop against a
metered API is the expensive failure mode.

### Bundle constraint

A test in local-runtime asserting that `src/index.ts`'s transitive imports never reach
`@anthropic-ai/sdk`. Without it, one convenience re-export silently inlines the SDK into design-mcp's
published package, and nobody notices until someone inspects the tarball.

### Manual verification

A real generation against the live API needs an API key and costs money per run, so it is an opt-in
manual smoke test. It is also the only test that answers the question that matters: does a real model,
given a real plan, produce a site that passes review on the first attempt?

## Open question for implementation

First-pass review success rate is unknown. If real runs fail review often even after the repair
call, the response is to strengthen the prompt's constraint section rather than to raise the repair
limit — repeated repair attempts multiply cost without addressing why the first output was wrong.

## Follow-on work

1. Live-updating preview: render pipeline phases and swap the frame from `/api/v1/events`.
2. Unified surface: embed Preview inside Studio, revisiting the ADR 0001 origin separation.
3. Chat-driven iteration: a chat bar issuing revisions against an existing project.
