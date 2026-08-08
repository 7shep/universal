import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createDesignPlan,
  DESIGN_RULE_CATEGORIES,
  getActiveTasteProfile,
  getDesignRules
} from './design.js';
import { registerArtDirectorTools } from './art-director-mcp.js';
import { registerRuntimeBuildTools } from './runtime-build-mcp.js';
import { reviewImplementation } from '@universal/design-linter';
import { installSkills, type InstallSkillsTarget } from './install-skills.js';
// `package.json` is the single source of truth for the version this server
// reports in the MCP handshake. This import resolves at build time: under
// `tsc` (used by the unit-test build) it stays a relative import that Node
// resolves against the on-disk file; under the esbuild bundle that ships in
// the published tarball (see scripts/bundle.mjs), esbuild's JSON loader
// inlines the value directly into dist/index.js, so no package.json lookup
// happens at runtime for installed consumers.
import packageJson from '../package.json' with { type: 'json' };

const server = new McpServer({ name: 'universal', version: packageJson.version });
registerArtDirectorTools(server);
registerRuntimeBuildTools(server);

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
    content: [{ type: 'text', text: JSON.stringify(await createDesignPlan(input), null, 2) }]
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

/**
 * Thrown for a malformed `install-skills` invocation. Kept distinct from any error the
 * installer itself might throw so `main()` can report it as a CLI usage mistake instead of
 * letting it fall through to the generic "server failed to start" catch-all — a typo in a flag
 * has nothing to do with the MCP server failing to boot, and telling the user that sends them
 * looking in the wrong place.
 */
class CliArgumentError extends Error {}

interface ParsedInstallSkillsArgs {
  force: boolean;
  dryRun: boolean;
  target: InstallSkillsTarget | undefined;
  cwd: string | undefined;
}

const INSTALL_SKILLS_BOOLEAN_FLAGS = new Set(['--force', '--dry-run']);
const INSTALL_SKILLS_VALUE_FLAGS = new Set(['--target', '--cwd']);

function parseBooleanFlagValue(flagName: string, rawValue: string | undefined): boolean {
  if (rawValue === undefined) return true;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new CliArgumentError(
    `Invalid ${flagName} value ${JSON.stringify(rawValue)}. Expected true or false, or omit the value.`
  );
}

/**
 * A strict parser for `install-skills` CLI flags. Every flag must be spelled exactly
 * (`--dry-run`, not `--dryrun`; `--target`, not `--targetfoo`) so a typo is reported as a clear
 * usage error rather than silently ignored (a misspelled `--dry-run` must never fall through to
 * a real install) or misparsed against the wrong flag. Unrecognized `--` arguments are rejected
 * rather than ignored, for the same reason.
 */
function parseInstallSkillsArgs(argv: string[]): ParsedInstallSkillsArgs {
  const result: ParsedInstallSkillsArgs = {
    force: false,
    dryRun: false,
    target: undefined,
    cwd: undefined
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i] as string;
    if (!raw.startsWith('--')) {
      throw new CliArgumentError(`Unrecognized argument ${JSON.stringify(raw)}.`);
    }
    const equalsIndex = raw.indexOf('=');
    const name = equalsIndex === -1 ? raw : raw.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : raw.slice(equalsIndex + 1);

    if (INSTALL_SKILLS_BOOLEAN_FLAGS.has(name)) {
      const value = parseBooleanFlagValue(name, inlineValue);
      if (name === '--force') result.force = value;
      else result.dryRun = value;
      continue;
    }

    if (INSTALL_SKILLS_VALUE_FLAGS.has(name)) {
      let value = inlineValue;
      if (value === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          throw new CliArgumentError(`${name} requires a value.`);
        }
        value = next;
        i++;
      }
      // An empty value reaches here from both `--cwd=` (inline) and `--cwd ""` (separate, since an
      // empty argument does not start with `--`). Left unchecked it flows into `resolve('')`, which
      // Node resolves to the process's current directory — so a malformed command would quietly
      // install into whatever project the shell happens to be in instead of failing.
      if (value.trim() === '') {
        throw new CliArgumentError(`${name} requires a non-empty value.`);
      }
      if (name === '--target') {
        if (value !== 'agents' && value !== 'claude' && value !== 'both') {
          throw new CliArgumentError(
            `Invalid --target value ${JSON.stringify(value)}. Expected agents, claude, or both.`
          );
        }
        result.target = value;
      } else {
        result.cwd = value;
      }
      continue;
    }

    throw new CliArgumentError(`Unrecognized flag ${JSON.stringify(name)}.`);
  }

  return result;
}

async function main(): Promise<void> {
  if (process.argv[2] === 'install-skills') {
    let parsed: ParsedInstallSkillsArgs;
    try {
      parsed = parseInstallSkillsArgs(process.argv.slice(3));
    } catch (error) {
      if (error instanceof CliArgumentError) {
        console.error(`install-skills: ${error.message}`);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    const { force, dryRun, target, cwd } = parsed;
    const result = await installSkills({
      force,
      dryRun,
      ...(target !== undefined ? { target } : {}),
      ...(cwd !== undefined ? { cwd } : {})
    });
    const directories = (count: number): string =>
      count + (count === 1 ? ' skill directory' : ' skill directories');
    const verb = (installed: string, dry: string): string => (dryRun ? dry : installed);

    for (const targetResult of result.targets) {
      console.log(`Target ${targetResult.name} (${targetResult.root}):`);
      console.log(
        '  ' +
          verb('Installed', '[dry run] Would install') +
          ' ' +
          directories(targetResult.installed.length) +
          '.'
      );
      if (targetResult.updated.length > 0) {
        console.log(
          '  ' +
            verb('Updated', '[dry run] Would update') +
            ' ' +
            directories(targetResult.updated.length) +
            ' to the bundled version.'
        );
      }
      if (targetResult.unchanged.length > 0) {
        console.log('  Already up to date: ' + directories(targetResult.unchanged.length) + '.');
      }
      if (targetResult.preserved.length > 0) {
        console.log(
          '  ' +
            verb('Preserved', '[dry run] Would preserve') +
            ' ' +
            directories(targetResult.preserved.length) +
            ' with local edits. Re-run with --force to overwrite them.'
        );
      }
    }
    return;
  }
  await server.connect(new StdioServerTransport());
  console.error('Universal MCP server connected over stdio.');
}

main().catch((error: unknown) => {
  console.error('Universal MCP server failed to start:', error);
  process.exitCode = 1;
});
