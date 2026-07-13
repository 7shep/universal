# Connect Universal MCP to Codex

## Install and build

From the repository root:

```bash
pnpm install
pnpm --filter @universal/design-mcp build
```

## Run manually

The MCP protocol runs over standard input/output, so it will wait for a client rather than printing a user interface:

```bash
pnpm --filter @universal/design-mcp start
```

The compiled executable is `packages/design-mcp/dist/index.js`.

## Codex MCP configuration

Add this server to your Codex MCP configuration, replacing the path if your checkout lives elsewhere:

```json
{
  "mcpServers": {
    "universal": {
      "command": "node",
      "args": ["C:\\Users\\alex\\Desktop\\universal\\packages\\design-mcp\\dist\\index.js"]
    }
  }
}
```

Restart or reconnect Codex after saving the configuration. The available tools should be `create_design_plan`, `get_design_rules`, and `review_implementation`.

## Verify the connection

1. Build the package with the command above.
2. Restart Codex and inspect its MCP tools list for `universal`.
3. Ask Codex to call `get_design_rules` with `{"category":"website"}`. A JSON response confirms the connection.

## Demo workflow

Open Codex in `examples/demo-site`, then paste:

```text
Use the Universal MCP to design and implement a one-page website for a premium mechanical keyboard brand.

The design should feel industrial, tactile, precise, and editorial.

Create one scroll-driven exploded-view sequence for the keyboard. Start with the assembled keyboard, then as the reader scrolls, separate the keycaps, switch plate, switches, PCB, and aluminum chassis into restrained depth layers. Use subtle parallax, map progress to transform and opacity, preserve normal scrolling, and provide a complete static exploded state for `prefers-reduced-motion`.

Do not add backend functionality.

Generate static React code only.

After implementation, run the project and capture screenshots at desktop and mobile widths. Check every major section for unearned empty space, blank logo or media regions, and placeholder-like visual areas. Pass those observations to the MCP review tool before finishing.
```

Run the result with:

```bash
pnpm --filter @universal/demo-site dev
```

## Troubleshooting

- **No tools appear:** rebuild `@universal/design-mcp`, check the absolute config path, then reconnect Codex.
- **Server exits immediately:** run the manual command and inspect stderr; no non-protocol output may reach stdout.
- **Command not found:** run from the monorepo root and use `pnpm --filter @universal/design-mcp ...`.
- **Demo port is busy:** Vite uses port `5175` with `strictPort`; stop the process using it or change `examples/demo-site/vite.config.ts`.
