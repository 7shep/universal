# @universal/preview

Preview embeds a runtime-issued immutable production build in a scripts-only sandboxed iframe and
renders the lifecycle state of the selected project when no build is available.

## Commands

```bash
pnpm --filter @universal/preview dev
pnpm --filter @universal/preview test
pnpm --filter @universal/preview typecheck
pnpm --filter @universal/preview lint
pnpm --filter @universal/preview build
```

## Tests

`pnpm test` runs `vitest run`, which covers both suites in `src`:

- `preview-client.test.ts` — how runtime records map to view states, and which runtime responses are
  rejected as stale, mismatched, or unsafe.
- `preview-app.test.tsx` — component coverage for the lifecycle states Preview renders, driven by an
  injected fake `PreviewClient`. No runtime, network, or generated build is required.

The component tests assert the semantics that are easy to regress silently: which panel carries
`role="status"` versus `role="alert"`, the matching `aria-live` politeness, whether a structured
diagnostic is visible, that every state is distinguishable by its status text rather than colour
alone, that the iframe sandbox stays `allow-scripts` only, and that the escape routes out of a
broken state are real keyboard-focusable links. They avoid full-DOM snapshots so that visual changes
do not produce false failures.

### Test dependencies

Preview is a Vite app, so its component tests run under Vitest rather than the bare `node --test`
runner used by the data-only packages: Vitest reuses the app's own Vite pipeline for JSX and
TypeScript, which `node --experimental-strip-types` cannot do.

| Dependency               | Why                                                             |
| ------------------------ | --------------------------------------------------------------- |
| `vitest`                 | Test runner sharing the app's Vite transform pipeline           |
| `jsdom`                  | DOM environment so React effects and live regions can run       |
| `@testing-library/react` | Renders components and queries them the way assistive tech does |

All three are development-only and are not bundled into the app.
