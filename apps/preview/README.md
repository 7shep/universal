# @universal/preview

Preview embeds a runtime-issued immutable production build in a scripts-only sandboxed iframe and
renders the lifecycle state of the selected project when no build is available.

## How Preview learns about a build

Preview does **not** talk to the generated site. It reads versioned runtime records from the trusted
local runtime over its HTTP API and validates every response against `@universal/runtime-contracts`
before any state change: a descriptor whose project, build, or revision does not match the runtime's
own record is rejected as stale, and a non-loopback preview origin is rejected outright. Only then is
the build embedded.

There is deliberately **no `postMessage` channel** between the host page and the framed build. ADR
0001 §9 lists a privileged `postMessage` bridge as an iframe-escape threat and excludes it, so the
frame stays `sandbox="allow-scripts"` with no same-origin, navigation, popup, download, or form
capability, and it receives no messages it could act on. Build state, readiness, failure, and reload
therefore travel over the runtime contract rather than through the untrusted frame. Changing that
boundary needs an ADR amendment, not a component change.

Viewport width and manual reload are host-side controls: they resize and remount the frame from the
outside, without asking the generated code to cooperate.

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

The component tests assert the semantics that are easy to regress silently, including the viewport
controls, manual reload, and diagnostic retention described above: which panel carries
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
