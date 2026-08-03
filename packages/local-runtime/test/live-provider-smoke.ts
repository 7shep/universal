// Opt-in manual smoke test for the live CLI provider. Not part of `pnpm test`:
// it needs an authenticated CLI and consumes real subscription usage.
//
//   pnpm --filter @universal/local-runtime smoke:live          # claude-code
//   pnpm --filter @universal/local-runtime smoke:live codex
//
// It is the only check that answers the question the unit tests cannot: does a
// real model, given a real plan, produce a project that passes the gate?
//
// Observed on 2026-08-02, both passing the gate on the first pass with no repair:
//   claude-code  429s  18 files
//   codex        126s  11 files
// The 10-minute budget in `provider.ts` was chosen against those numbers, and the
// claude-code run leaves under three minutes of headroom.
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import { createProjectGenerationRequest, ReactGenerator } from '@universal/generation';
import { cliProviderFactory, selfCheck } from '../src/cli-generation/index.ts';

const id = (process.argv[2] ?? 'claude-code') as 'claude-code' | 'codex';
const plan = compileDesignPlanV2({
  brief: fixtureCreativeBrief,
  evaluation: fixtureSelectedDirectionEvaluation,
  providerOutput: serializedFixtureDesignPlanV2Draft,
  now: '2026-07-28T12:10:00.000Z'
});
const request = createProjectGenerationRequest({
  projectId: 'project:smoke',
  revisionId: 'revision:smoke:1',
  designPlan: plan
});

console.log(`provider: ${id}`);
console.log(`routes: ${request.context.pageMap.pages.map((p) => p.route).join(', ')}`);
const started = Date.now();
const provider = cliProviderFactory.create({ providerId: id });
const result = await new ReactGenerator(provider).generate(request);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (!result.ok) {
  console.log(`FAILED after ${seconds}s: [${result.failure.code}] ${result.failure.message}`);
  process.exit(1);
}
console.log(`completed in ${seconds}s with ${result.project.files.length} files:`);
for (const file of result.project.files)
  console.log(`  ${file.path} (${file.content.length} chars)`);
const gaps = selfCheck({ files: result.project.files }, request);
console.log(gaps.length === 0 ? 'GATE: pass' : `GATE: ${gaps.length} gap(s)\n  ${gaps.join('\n  ')}`);
