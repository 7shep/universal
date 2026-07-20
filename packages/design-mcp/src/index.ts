import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createDesignPlan,
  DESIGN_RULE_CATEGORIES,
  getActiveTasteProfile,
  getDesignRules
} from './design.js';
import { reviewImplementation } from '@universal/design-linter';

const server = new McpServer({ name: 'universal', version: '0.2.0' });

const tasteDirectionSchema = z.object({
  profileId: z.string().min(1),
  profileVersion: z.string().min(1),
  designThesis: z.string().min(1),
  decisions: z
    .array(
      z.object({
        category: z.enum([
          'typography',
          'color',
          'composition',
          'navigation',
          'imagery',
          'copy',
          'motion',
          'controls'
        ]),
        choice: z.string().min(1),
        rationale: z.string().min(1),
        source: z.enum(['brief', 'selected-direction', 'taste-policy']),
        confidence: z.number().min(0).max(1)
      })
    )
    .min(3)
    .max(5),
  typographyRationale: z.string().min(1),
  colorRationale: z.string().min(1),
  visualTreatmentRationale: z.string().min(1),
  navigationRationale: z.string().min(1),
  signatureInteraction: z
    .object({ concept: z.string().min(1), purpose: z.string().min(1) })
    .optional(),
  motionRationale: z.string().min(1),
  reducedMotionBehavior: z.string().min(1),
  rejectedDefaultPatterns: z.array(z.string()),
  exceptions: z.array(z.object({ pattern: z.string().min(1), rationale: z.string().min(1) }))
});

server.tool(
  'create_design_plan',
  'Create a structured visual direction for a website before implementation, including opt-in scroll-driven motion direction when requested.',
  {
    prompt: z.string().min(1).describe('Natural-language website request.'),
    websiteType: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
    compositionSeed: z.number().int().nonnegative().optional(),
    recentSignatures: z
      .array(
        z.object({
          heroArchetype: z.string(),
          navigationMode: z.enum([
            'standard-horizontal',
            'corner-controls',
            'perimeter',
            'overlay-minimal',
            'vertical-rail',
            'masthead',
            'embedded-index',
            'utility-dock'
          ]),
          sectionSequence: z.array(z.string()),
          preset: z.enum(['editorial', 'industrial', 'minimal', 'playful', 'technical', 'luxury'])
        })
      )
      .optional()
  },
  async (input) => ({
    content: [{ type: 'text', text: JSON.stringify(createDesignPlan(input), null, 2) }]
  })
);

server.tool(
  'get_design_rules',
  'Return Universal global principles plus guidance for a supported design category.',
  {
    category: z
      .enum(DESIGN_RULE_CATEGORIES)
      .optional()
      .describe(`Guidance category: ${DESIGN_RULE_CATEGORIES.join(', ')}.`)
  },
  async ({ category }) => ({
    content: [{ type: 'text', text: JSON.stringify(getDesignRules(category), null, 2) }]
  })
);

server.tool(
  'get_taste_profile',
  'Return the active versioned taste profile, principles, anti-pattern guidance, and selection criteria.',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(getActiveTasteProfile(), null, 2) }]
  })
);

server.tool(
  'review_implementation',
  'Review React and CSS for generic visual anti-patterns. Before shipping, attach desktop and mobile screenshot evidence and confirm checks for empty space and missing media or marks.',
  {
    files: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1),
    visualEvidence: z
      .object({
        screenshots: z
          .array(
            z.object({
              viewport: z.string().min(1),
              location: z.string().optional(),
              notes: z.string().optional()
            })
          )
          .min(1),
        checkedForEmptySpace: z.boolean(),
        checkedForMissingMedia: z.boolean(),
        visualObservations: z
          .array(
            z.object({
              viewport: z.string().min(1),
              observation: z.string().min(1),
              ruleIds: z.array(z.string()).optional()
            })
          )
          .optional()
      })
      .optional(),
    compositionContext: z
      .object({
        expectedSignature: z
          .object({
            heroArchetype: z.string(),
            navigationMode: z.enum([
              'standard-horizontal',
              'corner-controls',
              'perimeter',
              'overlay-minimal',
              'vertical-rail',
              'masthead',
              'embedded-index',
              'utility-dock'
            ]),
            sectionSequence: z.array(z.string()),
            preset: z.enum(['editorial', 'industrial', 'minimal', 'playful', 'technical', 'luxury'])
          })
          .optional(),
        recentSignatures: z
          .array(
            z.object({
              heroArchetype: z.string(),
              navigationMode: z.enum([
                'standard-horizontal',
                'corner-controls',
                'perimeter',
                'overlay-minimal',
                'vertical-rail',
                'masthead',
                'embedded-index',
                'utility-dock'
              ]),
              sectionSequence: z.array(z.string()),
              preset: z.enum([
                'editorial',
                'industrial',
                'minimal',
                'playful',
                'technical',
                'luxury'
              ])
            })
          )
          .optional(),
        tasteDirection: tasteDirectionSchema.optional()
      })
      .optional()
  },
  async ({ files, visualEvidence, compositionContext }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          reviewImplementation(files, visualEvidence, compositionContext),
          null,
          2
        )
      }
    ]
  })
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('Universal MCP server connected over stdio.');
}

main().catch((error: unknown) => {
  console.error('Universal MCP server failed to start:', error);
  process.exitCode = 1;
});
