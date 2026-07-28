import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  getDifferingConceptDimensions,
  validateConceptProviderOutput,
  validateDesignPlanV2,
  type DiscoveryAnswer,
  type DiscoveryQuestion,
  type DiscoveryTopic,
  type PageMap
} from '@universal/design-engine';
import {
  createProjectGenerationRequest,
  DeterministicReactProvider,
  ReactGenerator,
  type RawGeneratedProject,
  type ReactGenerationProvider
} from '@universal/generation';
import { RuntimeService } from '@universal/local-runtime';
import { ArtDirectorOrchestrator, ArtDirectorError } from './art-director.js';
import { createArtDirectorMcpAdapter } from './art-director-mcp.js';
import { createIntegratedArtDirectorDependencies } from './art-director-services.js';
import { createRuntimeBuildMcpAdapter } from './runtime-build-mcp.js';

const pages: PageMap = {
  kind: 'multi-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Understand why the keyboard is worth considering and explore the flagship.',
      primaryMessage: 'A mechanical keyboard engineered as a lasting desktop instrument.',
      requiredSections: ['hero', 'material story', 'flagship proof', 'purchase path'],
      requiredContent: ['flagship keyboard', 'machined aluminum', 'switch options', 'warranty'],
      primaryAction: 'Explore the flagship keyboard',
      secondaryActions: ['Compare switches'],
      navigationRelationship: 'Primary entry in a restrained product index.',
      uniqueResponsibility: 'Establish desire and engineering credibility.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['material study', 'flagship overview']
    },
    {
      id: 'product',
      route: '/keyboards/monolith-75',
      name: 'Monolith 75',
      userGoal: 'Evaluate configuration, acoustics, materials, and delivery.',
      primaryMessage: 'Configure a precisely tuned 75% keyboard.',
      requiredSections: [
        'configuration',
        'sound and feel',
        'materials',
        'specifications',
        'purchase'
      ],
      requiredContent: ['layout', 'switches', 'keycaps', 'dimensions', 'lead time', 'price'],
      primaryAction: 'Configure Monolith 75',
      secondaryActions: ['Listen to sound tests'],
      navigationRelationship: 'Product detail beneath the keyboard index.',
      uniqueResponsibility: 'Turn tactile qualities into a confident purchase decision.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['configuration ledger', 'specifications']
    },
    {
      id: 'craft',
      route: '/craft',
      name: 'Craft',
      userGoal: 'Verify manufacturing philosophy and long-term support.',
      primaryMessage: 'Designed to be maintained, repaired, and kept in use.',
      requiredSections: ['design principles', 'manufacturing', 'assembly', 'repair', 'makers'],
      requiredContent: ['design process', 'material sourcing', 'repair program', 'team'],
      primaryAction: 'Read the repair promise',
      secondaryActions: ['Meet the makers'],
      navigationRelationship: 'Editorial route adjacent to products.',
      uniqueResponsibility: 'Provide human and operational proof behind the positioning.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['workshop record', 'exploded assembly']
    }
  ]
};
const answers: Record<
  Exclude<DiscoveryTopic, 'page-map'>,
  { summary: string; details?: readonly string[]; mode?: DiscoveryAnswer['mode'] }
> = {
  purpose: {
    summary: 'Sell the flagship keyboard while establishing a durable luxury hardware brand.'
  },
  audience: {
    summary:
      'Design-conscious developers, writers, and collectors who value tactility and repairability.'
  },
  positioning: { summary: 'A serviceable desktop instrument, not disposable gaming hardware.' },
  'emotional-response': {
    summary: 'Quiet confidence, material curiosity, and trust in long-term ownership.'
  },
  'page-content': {
    summary:
      'Lead with the flagship, prove sound and materials, expose configuration and service details, then document the workshop.',
    details: ['Every route has one responsibility and complete required content.']
  },
  hero: { summary: 'Monolith 75. Built to outlast the desk around it.' },
  navigation: { summary: 'A quiet product index: Index, Monolith 75, Craft.' },
  color: {
    summary: 'Near-black aluminum, warm paper, bone keycaps, and one oxblood signal.',
    mode: 'preference'
  },
  typography: {
    summary: 'High-contrast editorial display with a restrained grotesk body and utility voice.',
    mode: 'preference'
  },
  'brand-assets': {
    summary:
      'No supplied logo; use the textual STILL / FORM mark only as a clearly identified fixture.'
  },
  imagery: {
    summary:
      'Macro material studies, honest desk context, exploded assemblies, and workshop documentation.'
  },
  constraints: {
    summary:
      'WCAG 2.2 AA, semantic landmarks, visible focus, keyboard access, mobile reflow, stable reading order, and reduced motion.',
    details: ['Static presentational behavior only.']
  },
  references: {
    summary: 'Precision industrial editorial catalogs and service manuals.',
    mode: 'preference'
  },
  'anti-patterns': {
    summary:
      'Reject gamer neon, generic SaaS heroes, equal card grids, decorative gradients, fake scarcity, black-and-gold clichés, nested cards, and arbitrary stock imagery.',
    mode: 'preference'
  }
};
function answer(question: DiscoveryQuestion, tick: number): DiscoveryAnswer {
  const value = answers[question.topic as Exclude<DiscoveryTopic, 'page-map'>];
  return {
    questionId: question.id,
    topic: question.topic,
    mode: value.mode ?? 'exact',
    value: { summary: value.summary, ...(value.details ? { details: value.details } : {}) },
    answeredAt: `2026-07-28T14:${String(tick).padStart(2, '0')}:00.000Z`
  };
}

test(
  'golden Phase 3: approved luxury keyboard plan generates, builds, previews, reviews, and preserves last known good',
  { timeout: 240_000 },
  async () => {
    let clock = 0;
    const orchestrator = new ArtDirectorOrchestrator(
        createIntegratedArtDirectorDependencies({
          now: () => `2026-07-28T14:${String(clock++).padStart(2, '0')}:00.000Z`,
          createSessionId: () => 'art-direction:phase3-keyboard'
        })
      ),
      adapter = createArtDirectorMcpAdapter(orchestrator);
    let surface = await adapter.startArtDirection({
      prompt: 'Luxury mechanical keyboard company',
      requestId: 'phase3:start'
    });
    const asked = new Set<DiscoveryTopic>();
    for (let round = 0; round < 20; round++) {
      const next = await adapter.getDiscoveryQuestions(surface.session),
        questions = next.data as readonly DiscoveryQuestion[];
      if (questions.length === 0) break;
      questions.forEach((question) => asked.add(question.topic));
      const batch = questions
        .filter((question) => question.topic !== 'page-map')
        .map((question) => answer(question, round));
      surface = await adapter.submitDiscoveryAnswers(surface.session, {
        requestId: `phase3:discovery:${round}`,
        ...(batch.length ? { answers: batch } : {}),
        ...(questions.some((question) => question.topic === 'page-map') ? { pageMap: pages } : {})
      });
    }
    for (const topic of [
      'purpose',
      'audience',
      'emotional-response',
      'hero',
      'color',
      'typography',
      'navigation',
      'page-map',
      'page-content',
      'imagery',
      'constraints',
      'anti-patterns'
    ] as const)
      assert.ok(asked.has(topic), `discovery never asked about ${topic}`);
    const reviewed = await adapter.getCreativeBrief(surface.session, { requestId: 'phase3:brief' });
    await assert.rejects(
      () => adapter.developArtDirection(reviewed.session, { requestId: 'phase3:premature' }),
      (error: unknown) => error instanceof ArtDirectorError
    );
    const approved = await adapter.approveCreativeBrief(reviewed.session, {
      approvedBy: 'phase3-golden-user',
      requestId: 'phase3:approve'
    });
    const brief = approved.state.discovery.brief!;
    assert.equal(brief.approval.approvedDigest, brief.digest);
    assert.equal(brief.content.pageMap.pages.length, 3);
    const developed = await adapter.developArtDirection(approved.session, {
      requestId: 'phase3:concepts'
    });
    const candidates = validateConceptProviderOutput(
      { candidates: developed.state.concepts!.candidates },
      3
    );
    assert.equal(candidates.length, 3);
    for (let left = 0; left < candidates.length; left++)
      for (let right = left + 1; right < candidates.length; right++)
        assert.ok(getDifferingConceptDimensions(candidates[left]!, candidates[right]!).length >= 4);
    const selected = await adapter.getSelectedDirection(developed.session, {
      requestId: 'phase3:direction'
    });
    assert.match(selected.state.selectedDirection!.rationale, /recommended/i);
    const planned = await adapter.createDesignPlanV2(selected.session, {
      requestId: 'phase3:plan'
    });
    const checked = validateDesignPlanV2(planned.state.designPlan!.plan);
    assert.equal(checked.ok, true);
    if (!checked.ok) return;
    const plan = checked.value;
    assert.equal(plan.source.briefDigest, brief.digest);
    assert.equal(plan.pageMap.pages.length, 3);
    const deterministic = new DeterministicReactProvider();
    const submittedProject: RawGeneratedProject = {
        files: [
          {
            path: 'src/App.tsx',
            kind: 'react',
            content: `const routes = [
  { href: '/', label: 'Index', title: 'A quieter instrument for lasting work.' },
  { href: '/keyboards/monolith-75', label: 'Monolith 75', title: 'Tune the material, sound, and feel.' },
  { href: '/craft', label: 'Craft', title: 'Designed to be opened, repaired, and kept.' }
];
export default function App() {
  const current = routes.find((route) => route.href === window.location.pathname) ?? routes[0]!;
  return <><nav aria-label="Primary"><strong>STILL / FORM</strong>{routes.map((route) => <a key={route.href} href={route.href}>{route.label}</a>)}</nav><main><p>Model-authored / plan-bound / runtime-validated</p><h1>{current.title}</h1><section aria-labelledby="record"><h2 id="record">Material record</h2><p>Machined aluminum, serviceable switches, and a repair promise expressed as an editorial product ledger.</p></section></main></>;
}`
          },
          {
            path: 'src/styles.css',
            kind: 'stylesheet',
            content: `:root{font-family:Arial,sans-serif;color:#eee;background:#151412}*{box-sizing:border-box}body{margin:0}nav{display:flex;gap:2rem;padding:1.25rem}nav a{color:inherit}main{min-height:100vh;padding:clamp(2rem,8vw,8rem)}h1{max-width:12ch;font-family:Georgia,serif;font-size:clamp(3rem,9vw,8rem);line-height:.9}section{max-width:54rem;margin-top:6rem;border-top:1px solid;padding-top:2rem}:focus-visible{outline:3px solid #b84432;outline-offset:4px}@media(max-width:42rem){nav{align-items:flex-start;flex-direction:column;gap:.75rem}main{padding-top:4rem}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}`
          }
        ]
      },
      mcpWorkspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-mcp-build-')),
      mcpRepositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-mcp-repository-')),
      runtimeBuildAdapter = createRuntimeBuildMcpAdapter({
        workspaceRoot: mcpWorkspaceRoot,
        repositoryRoot: mcpRepositoryRoot
      }),
      preparation = await runtimeBuildAdapter.prepare(planned.session);
    assert.match(JSON.stringify(preparation), /build_react_project/);
    assert.match(JSON.stringify(preparation), new RegExp(plan.digest));

    const forbiddenSubmission = await runtimeBuildAdapter.build({
      session: planned.session,
      requestId: 'phase3:mcp-build:forbidden',
      files: [...submittedProject.files, { path: 'package.json', content: '{}', kind: 'text' }],
      assets: submittedProject.assets
    });
    assert.equal(forbiddenSubmission.ok, false);
    if (!forbiddenSubmission.ok)
      assert.match(JSON.stringify(forbiddenSubmission.error), /GENERATION_FAILURE/);

    const trustedSubmission = await runtimeBuildAdapter.build({
      session: planned.session,
      requestId: 'phase3:mcp-build:success',
      files: submittedProject.files,
      assets: submittedProject.assets
    });
    assert.equal(
      trustedSubmission.ok,
      true,
      trustedSubmission.ok ? undefined : JSON.stringify(trustedSubmission.error)
    );
    if (!trustedSubmission.ok) throw new Error('Trusted MCP submission did not build.');
    assert.equal(trustedSubmission.review !== undefined, true);
    assert.match(trustedSubmission.workspacePath, /mcp-project/);
    assert.match(trustedSubmission.outputPath, /dist$/);
    assert.deepEqual(trustedSubmission.localDevelopment.args, ['run', 'dev']);
    assert.equal(trustedSubmission.localDevelopment.host, '127.0.0.1');
    assert.match(
      await readFile(path.join(trustedSubmission.workspacePath, 'package.json'), 'utf8'),
      /"dev": "vite --host 127\.0\.0\.1"/
    );
    const provider: ReactGenerationProvider = {
      capabilities: deterministic.capabilities,
      async generate(request, signal) {
        if (request.revisionId.includes('broken'))
          return {
            files: [
              { path: 'src/App.tsx', content: 'export default function App( {', kind: 'react' },
              {
                path: 'src/styles.css',
                content: ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){}',
                kind: 'stylesheet'
              }
            ]
          };
        return deterministic.generate(request, signal);
      }
    };
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-phase3-golden-')),
      repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-phase3-repository-')),
      runtime = new RuntimeService({
        workspaceRoot,
        repositoryRoot,
        generator: new ReactGenerator(provider)
      });
    await runtime.initialize();
    try {
      const request = createProjectGenerationRequest({
          projectId: 'project:phase3-keyboard',
          revisionId: 'revision:phase3-keyboard:1',
          designPlan: plan
        }),
        accepted = await runtime.startGeneration(request, 'phase3:generate:1'),
        operation = await runtime.waitForOperation(accepted.operation.id);
      assert.equal(operation.status, 'ready', operation.error?.message);
      const descriptor = runtime.preview(request.projectId),
        response = await fetch(descriptor.url);
      assert.equal(response.status, 200);
      const html = await response.text(),
        scriptPath = /src="([^"]+\.js)"/.exec(html)?.[1],
        stylePath = /href="([^"]+\.css)"/.exec(html)?.[1];
      assert.ok(scriptPath && stylePath);
      const [script, css] = await Promise.all([
        fetch(new URL(scriptPath, descriptor.url)).then((item) => item.text()),
        fetch(new URL(stylePath, descriptor.url)).then((item) => item.text())
      ]);
      for (const content of [
        'Built to',
        'outlast the',
        'Configuration ledger',
        'Designed to be opened',
        'Repair promise'
      ])
        assert.match(script, new RegExp(content, 'i'));
      assert.match(script, /aria-label/);
      assert.match(css, /focus-visible/);
      assert.match(css, /prefers-reduced-motion/);
      assert.doesNotMatch(
        `${script}\n${css}`,
        /gamer neon|generic saas|fake scarcity|black-and-gold|cards? inside cards?/i
      );
      for (const route of plan.pageMap.pages)
        assert.equal((await fetch(new URL(route.route, descriptor.url))).status, 200);
      const state = runtime.state(),
        projectRecord = state.projects.find((item) => item.id === request.projectId)!,
        revision = state.revisions.find((item) => item.id === request.revisionId)!,
        build = state.builds.find((item) => item.id === descriptor.buildId)!;
      assert.equal(projectRecord.briefDigest, brief.digest);
      assert.equal(projectRecord.directionDigest, plan.source.evaluationDigest);
      assert.equal(projectRecord.designPlanDigest, plan.digest);
      assert.equal(revision.designPlanDigest, plan.digest);
      assert.equal(build.revisionId, revision.id);
      assert.equal(descriptor.revisionId, revision.id);
      assert.equal(build.review?.status, 'pass');
      assert.deepEqual(
        request.context.decisionProvenanceIds,
        plan.decisionProvenance.map((item) => item.id)
      );
      assert.equal(request.brief.approvalDigest, brief.approval.approvedDigest);
      const brokenRequest = createProjectGenerationRequest({
          projectId: request.projectId,
          revisionId: 'revision:phase3-keyboard:broken',
          designPlan: plan
        }),
        broken = await runtime.startGeneration(brokenRequest, 'phase3:generate:broken'),
        failed = await runtime.waitForOperation(broken.operation.id);
      assert.equal(failed.status, 'failed');
      assert.equal(runtime.preview(request.projectId).buildId, descriptor.buildId);
    } finally {
      await runtime.shutdown();
    }
  }
);
