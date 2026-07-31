# @universal/studio

Studio runs the four-stage art direction workflow — discovery, brief, direction, plan — and hands an
approved Design Plan v2 to the trusted local runtime.

See [docs/STUDIO.md](../../docs/STUDIO.md) for the product walkthrough and setup.

## Commands

```bash
pnpm --filter @universal/studio dev
pnpm --filter @universal/studio test
pnpm --filter @universal/studio typecheck
pnpm --filter @universal/studio lint
pnpm --filter @universal/studio build
```

## Tests

`pnpm test` runs `vitest run` over three suites in `src`:

- `studio-client.test.ts` — the MCP client adapter and its engine contracts.
- `runtime-client.test.ts` — the generation lifecycle adapter.
- `studio-app.test.tsx` — component coverage for the visible four-stage workflow.

`StudioApp` takes both of its clients as props, so the component tests inject a deterministic
in-memory `ArtDirectorClient` and an inert generation client. No network, stdio session, or model
provider is involved, and the tests do not restate the engine contract assertions that
`studio-client.test.ts` already owns.

They cover prompt validation and submission, one discovery answer mode and the authorship shown for
compiled decisions, explicit brief approval, direction review through to the rendered Design Plan v2,
and one recoverable client failure with a retry — asserting accessible names, disabled and loading
labels, live-region roles, and focus along the way.

### Test dependencies

Studio is a Vite app and its components are `.tsx`; `node --experimental-strip-types` cannot strip
JSX, so the suite runs under Vitest and reuses the app's own Vite transform pipeline rather than
adding a second one.

| Dependency               | Why                                                             |
| ------------------------ | --------------------------------------------------------------- |
| `vitest`                 | Test runner sharing the app's Vite transform pipeline           |
| `jsdom`                  | DOM environment so React effects and live regions can run       |
| `@testing-library/react` | Renders components and queries them the way assistive tech does |

All three are development-only and are not bundled into the app.
