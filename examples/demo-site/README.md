# Axis 65 demo site

Axis 65 is a small static React/Vite site for a fictional mechanical-keyboard brand. It gives
contributors a concrete interface to inspect, plan, redesign, and review with Universal without
introducing a backend or a real brand dependency.

## Important files

| File                                                         | Purpose                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [`src/app.tsx`](src/app.tsx)                                 | Page content, semantic structure, and component markup. |
| [`src/styles.css`](src/styles.css)                           | Layout, typography, responsive behavior, and motion.    |
| [`src/main.tsx`](src/main.tsx)                               | React entry point.                                      |
| [`src/assets/axis-65-hero.png`](src/assets/axis-65-hero.png) | Local product artwork used by the hero.                 |
| [`vite.config.ts`](vite.config.ts)                           | Fixed development port and React plugin configuration.  |

## Run the demo

From the repository root:

```bash
pnpm install
pnpm --filter @universal/demo-site dev
```

Open `http://localhost:5175`. The port is strict: if startup reports that 5175 is already in use,
stop the existing process or run:

```bash
pnpm --filter @universal/demo-site dev -- --port 6175
```

Then open the URL Vite prints. See [Local setup](../../docs/SETUP.md#port-conflicts) for platform
specific port inspection.

## Start the local MCP server

Build the server from the repository root:

```bash
pnpm --filter @universal/design-mcp build
pnpm --filter @universal/design-mcp start
```

The second command starts an MCP stdio process and waits for a client; it does not open a browser
or print an interactive prompt. Configure Codex by following
[Connect Universal MCP to Codex](../../docs/CODEX_MCP_SETUP.md). Keep the configuration in that
single guide rather than copying an absolute path from another checkout.

## Try a guided redesign

Open your coding agent in this repository and use this brief:

```text
Use Universal to redesign the existing Axis 65 demo for keyboard enthusiasts who care about
repairability and material craft.

Keep it a static, single-page React site. Preserve the supplied keyboard image and the product facts
already present in the page. Make switch layers, serviceability, and anodized aluminum the content
hierarchy—not generic technology decoration. Provide a clear mobile transformation, keyboard focus
states, and a reduced-motion alternative.
```

For a manual MCP-guided redesign, call `create_design_plan` and `get_design_rules` before editing
the existing [`src/app.tsx`](src/app.tsx) and [`src/styles.css`](src/styles.css). This path improves
the checked-in example in place.

The Phase 3 generation flow is different: after an approved Design Plan v2,
`prepare_react_generation` and `build_react_project` validate and materialize a new immutable
runtime-owned project. It does not overwrite this example checkout. See the
[MCP tool reference](../../docs/MCP_REFERENCE.md) for the current operations and session rules.

## Review the result

After implementing the redesign:

1. Run the demo and inspect it at desktop and mobile widths.
2. Check keyboard focus, reduced motion, horizontal overflow, unearned empty regions, and missing
   or placeholder-like media.
3. Submit the complete contents of `src/app.tsx` and `src/styles.css` to
   `review_implementation`.
4. Include desktop and mobile screenshot records plus concise visual observations.
5. Address practical high-severity findings and rerun the review.

The exact payload and result fields are documented under
[`review_implementation`](../../docs/MCP_REFERENCE.md#review_implementation).
