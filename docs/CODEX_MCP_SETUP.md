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

Do not add backend functionality.

Generate static React code only.

After implementation, run the project and use the MCP review tool before finishing.
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
