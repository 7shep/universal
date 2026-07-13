import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createDesignPlan, getDesignRules } from './design.js';
import { reviewImplementation } from './review.js';

const server = new McpServer({ name: 'universal', version: '0.1.0' });

server.tool('create_design_plan', 'Create a structured visual direction for a website before implementation.', {
  prompt: z.string().min(1).describe('Natural-language website request.'),
  websiteType: z.string().optional(),
  preferences: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional()
}, async (input) => ({ content: [{ type: 'text', text: JSON.stringify(createDesignPlan(input), null, 2) }] }));

server.tool('get_design_rules', 'Return Universal composition principles and anti-pattern constraints.', {
  category: z.string().optional()
}, async ({ category }) => ({ content: [{ type: 'text', text: JSON.stringify(getDesignRules(category), null, 2) }] }));

server.tool('review_implementation', 'Statically review React and CSS source text for generic visual anti-patterns.', {
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1)
}, async ({ files }) => ({ content: [{ type: 'text', text: JSON.stringify(reviewImplementation(files), null, 2) }] }));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('Universal MCP server connected over stdio.');
}

main().catch((error: unknown) => {
  console.error('Universal MCP server failed to start:', error);
  process.exitCode = 1;
});
