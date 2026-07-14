import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createDesignPlan, getDesignRules } from './design.js';
import { reviewImplementation } from './review.js';

const server = new McpServer({ name: 'universal', version: '0.1.0' });

server.tool('create_design_plan', 'Create a structured visual direction for a website before implementation, including opt-in scroll-driven motion direction when requested.', {
  prompt: z.string().min(1).describe('Natural-language website request.'),
  websiteType: z.string().optional(),
  preferences: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional()
  ,compositionSeed: z.number().int().nonnegative().optional()
  ,recentSignatures: z.array(z.object({
    heroArchetype: z.string(),
    navigationMode: z.enum(['standard-horizontal','corner-controls','perimeter','overlay-minimal','vertical-rail','masthead','embedded-index','utility-dock']),
    sectionSequence: z.array(z.string()),
    preset: z.enum(['editorial','industrial','minimal','playful','technical','luxury'])
  })).optional()
}, async (input) => ({ content: [{ type: 'text', text: JSON.stringify(createDesignPlan(input), null, 2) }] }));

server.tool('get_design_rules', 'Return Universal composition principles and anti-pattern constraints.', {
  category: z.string().optional()
}, async ({ category }) => ({ content: [{ type: 'text', text: JSON.stringify(getDesignRules(category), null, 2) }] }));

server.tool('review_implementation', 'Review React and CSS for generic visual anti-patterns. Before shipping, attach desktop and mobile screenshot evidence and confirm checks for empty space and missing media or marks.', {
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1),
  visualEvidence: z.object({
    screenshots: z.array(z.object({ viewport: z.string().min(1), location: z.string().optional(), notes: z.string().optional() })).min(1),
    checkedForEmptySpace: z.boolean(),
    checkedForMissingMedia: z.boolean()
  }).optional(),
  compositionContext: z.object({
    expectedSignature: z.object({
      heroArchetype: z.string(), navigationMode: z.enum(['standard-horizontal','corner-controls','perimeter','overlay-minimal','vertical-rail','masthead','embedded-index','utility-dock']), sectionSequence: z.array(z.string()), preset: z.enum(['editorial','industrial','minimal','playful','technical','luxury'])
    }).optional(),
    recentSignatures: z.array(z.object({
      heroArchetype: z.string(), navigationMode: z.enum(['standard-horizontal','corner-controls','perimeter','overlay-minimal','vertical-rail','masthead','embedded-index','utility-dock']), sectionSequence: z.array(z.string()), preset: z.enum(['editorial','industrial','minimal','playful','technical','luxury'])
    })).optional()
  }).optional()
}, async ({ files, visualEvidence, compositionContext }) => ({ content: [{ type: 'text', text: JSON.stringify(reviewImplementation(files, visualEvidence, compositionContext), null, 2) }] }));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('Universal MCP server connected over stdio.');
}

main().catch((error: unknown) => {
  console.error('Universal MCP server failed to start:', error);
  process.exitCode = 1;
});
