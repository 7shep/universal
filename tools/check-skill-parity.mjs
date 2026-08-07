// Verifies that .agents/skills/* and .claude/skills/* stay in sync.
//
// Skills are authored once in .agents/skills/<name>/SKILL.md and mirrored into
// .claude/skills/<name>/SKILL.md by packages/design-mcp/src/install-skills.ts.
// The .claude/ copy layers a small, fixed set of hand-maintained frontmatter
// keys on top (allowed-tools, argument-hint, disable-model-invocation) — see
// ALLOWED_EXTRA_CLAUDE_KEYS below, which is derived from the current tree
// rather than hard-coded speculation.
//
// This script would have caught the bug where .claude/skills/review-ui/SKILL.md
// was missing `disable-model-invocation: true`: every one of the 20 mirrored
// skills in the current tree sets that flag (they are all explicit-invocation
// "/command" style skills, never auto-invoked by the model) — review-ui was
// the sole exception. That is a corpus-wide invariant we can check directly,
// rather than a "read-only skill" classifier: there is no structured,
// reliable signal in these files for "is this skill read-only" (it's stated
// only in free-form prose in the description/body), and inventing a prose
// heuristic risks false positives on skills that phrase things differently.
// So this script checks the broader, actually-true invariant instead of
// guessing at read-only-ness.
//
// Checks performed, per skill directory found in .agents/skills:
//   1. The same skill directory (with a SKILL.md) exists under .claude/skills.
//   2. The markdown body (everything after the frontmatter block) is
//      byte-identical between the two trees.
//   3. The .claude/ frontmatter is a superset of the .agents/ frontmatter,
//      differing only by keys in ALLOWED_EXTRA_CLAUDE_KEYS.
//   4. The .claude/ frontmatter sets `disable-model-invocation: true`.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const agentsSkillsDir = path.join(repoRoot, '.agents', 'skills');
const claudeSkillsDir = path.join(repoRoot, '.claude', 'skills');

// Discovered empirically: across all 20 skills today, these are the only
// frontmatter keys the .claude/ copy ever adds on top of the .agents/ copy.
const ALLOWED_EXTRA_CLAUDE_KEYS = new Set(['allowed-tools', 'argument-hint', 'disable-model-invocation']);

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function splitFrontmatter(buffer) {
  const text = buffer.toString('utf8');
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return null;
  }
  const frontmatterText = match[1];
  const bodyStartIndex = Buffer.byteLength(match[0], 'utf8');
  return {
    frontmatterText,
    bodyBuffer: buffer.subarray(bodyStartIndex)
  };
}

// Minimal top-level `key: value` extraction. Frontmatter in this corpus is
// flat (no nested maps, no multiline block scalars) — this is not a general
// YAML parser and is not meant to become one.
function parseTopLevelKeys(frontmatterText) {
  const keys = new Set();
  for (const line of frontmatterText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function getValue(frontmatterText, key) {
  for (const line of frontmatterText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim();
    }
  }
  return undefined;
}

const errors = [];

if (!existsSync(agentsSkillsDir)) {
  console.error(`[check-skill-parity] missing directory: ${agentsSkillsDir}`);
  process.exit(1);
}

const skillNames = readdirSync(agentsSkillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (skillNames.length === 0) {
  console.error(`[check-skill-parity] no skills found under ${agentsSkillsDir}`);
  process.exit(1);
}

for (const name of skillNames) {
  const agentsPath = path.join(agentsSkillsDir, name, 'SKILL.md');
  const claudePath = path.join(claudeSkillsDir, name, 'SKILL.md');

  if (!existsSync(agentsPath)) {
    errors.push(`${name}: .agents/skills/${name}/SKILL.md does not exist`);
    continue;
  }
  if (!existsSync(claudePath)) {
    errors.push(`${name}: exists in .agents/skills but not in .claude/skills`);
    continue;
  }

  const agentsBuffer = readFileSync(agentsPath);
  const claudeBuffer = readFileSync(claudePath);

  const agentsSplit = splitFrontmatter(agentsBuffer);
  const claudeSplit = splitFrontmatter(claudeBuffer);

  if (!agentsSplit) {
    errors.push(`${name}: .agents/skills/${name}/SKILL.md has no parseable frontmatter block`);
    continue;
  }
  if (!claudeSplit) {
    errors.push(`${name}: .claude/skills/${name}/SKILL.md has no parseable frontmatter block`);
    continue;
  }

  // 2. Body must be byte-identical.
  if (!agentsSplit.bodyBuffer.equals(claudeSplit.bodyBuffer)) {
    errors.push(`${name}: markdown body differs between .agents/skills and .claude/skills`);
  }

  // 3. .claude frontmatter must be a superset of .agents frontmatter, only
  //    differing by keys in ALLOWED_EXTRA_CLAUDE_KEYS.
  const agentsKeys = parseTopLevelKeys(agentsSplit.frontmatterText);
  const claudeKeys = parseTopLevelKeys(claudeSplit.frontmatterText);

  const missingFromClaude = [...agentsKeys].filter((key) => !claudeKeys.has(key));
  if (missingFromClaude.length > 0) {
    errors.push(`${name}: .claude/skills frontmatter is missing key(s) present in .agents/skills: ${missingFromClaude.join(', ')}`);
  }

  const unexpectedExtraInClaude = [...claudeKeys].filter(
    (key) => !agentsKeys.has(key) && !ALLOWED_EXTRA_CLAUDE_KEYS.has(key)
  );
  if (unexpectedExtraInClaude.length > 0) {
    errors.push(`${name}: .claude/skills frontmatter has unexpected extra key(s) not in the allowed set (${[...ALLOWED_EXTRA_CLAUDE_KEYS].join(', ')}): ${unexpectedExtraInClaude.join(', ')}`);
  }

  for (const key of agentsKeys) {
    if (claudeKeys.has(key)) {
      const agentsValue = getValue(agentsSplit.frontmatterText, key);
      const claudeValue = getValue(claudeSplit.frontmatterText, key);
      if (agentsValue !== claudeValue) {
        errors.push(`${name}: frontmatter key "${key}" differs between trees (.agents=${JSON.stringify(agentsValue)}, .claude=${JSON.stringify(claudeValue)})`);
      }
    }
  }

  // 4. Every mirrored skill must be explicit-invocation-only.
  const disableModelInvocation = getValue(claudeSplit.frontmatterText, 'disable-model-invocation');
  if (disableModelInvocation !== 'true') {
    errors.push(`${name}: .claude/skills/${name}/SKILL.md must set "disable-model-invocation: true" (found ${JSON.stringify(disableModelInvocation)})`);
  }
}

// Also catch skills that exist only under .claude/skills.
const claudeOnlyNames = existsSync(claudeSkillsDir)
  ? readdirSync(claudeSkillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !skillNames.includes(name))
  : [];
for (const name of claudeOnlyNames) {
  errors.push(`${name}: exists in .claude/skills but not in .agents/skills`);
}

if (errors.length > 0) {
  console.error(`[check-skill-parity] ${errors.length} issue(s) found:\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`[check-skill-parity] OK — ${skillNames.length} skills in sync between .agents/skills and .claude/skills`);
}
