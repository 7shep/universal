import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import {
  createProjectGenerationRequest,
  ProviderError,
  ReactGenerator,
  type ProjectGenerationRequest,
  type RawGeneratedProject
} from '@universal/generation';
import {
  buildPrompt,
  buildRepairPrompt,
  claudeCodeArgs,
  CliGenerationProvider,
  codexArgs,
  isCliProviderId,
  probeCliProvider,
  selfCheck,
  unwrapClaudeEnvelope,
  type CliAdapter,
  type CliRunInput
} from '../src/cli-generation/index.ts';
import { cliProviderFactory } from '../src/cli-generation/index.ts';
import { createConfiguredGenerator } from '../src/provider-config.ts';
import { multiPageMap, requestWithPageMap } from './architecture-fixtures.ts';

const plan = compileDesignPlanV2({
  brief: fixtureCreativeBrief,
  evaluation: fixtureSelectedDirectionEvaluation,
  providerOutput: serializedFixtureDesignPlanV2Draft,
  now: '2026-07-28T12:10:00.000Z'
});
// The unmodified fixture request: ReactGenerator revalidates the whole request,
// so the page map has to stay consistent with the compiled plan.
const request = createProjectGenerationRequest({
  projectId: 'project:cli-generation',
  revisionId: 'revision:cli-generation:1',
  designPlan: plan
});
const componentName = (id: string) =>
  `${id.replace(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) => (next ?? '').toUpperCase()).replace(/^./, (first) => first.toUpperCase())}Page`;

/**
 * A project that satisfies every gate check, derived from the plan's own routes
 * rather than hardcoded, so the suite keeps testing the real contract if the
 * design fixture changes.
 */
function compliantFiles(target: ProjectGenerationRequest): Record<string, string> {
  const pages = target.context.pageMap.pages;
  const firstRoute = pages[0]!.route;
  const files: Record<string, string> = {
    'src/App.tsx':
      `import { SiteHeader } from './components/SiteHeader';\n` +
      `import { SiteFooter } from './components/SiteFooter';\n` +
      pages
        .map((page) => `import { ${componentName(page.id)} } from './pages/${componentName(page.id)}';`)
        .join('\n') +
      `\nconst ROUTES = {\n` +
      pages.map((page) => `  '${page.route}': ${componentName(page.id)}`).join(',\n') +
      `\n};\nexport default function App(){ const path = window.location.pathname;` +
      ` const Page = ROUTES[path as keyof typeof ROUTES] ?? ROUTES['${firstRoute}'];` +
      ` return <><SiteHeader activePath={path}/><Page/><SiteFooter/></>; }`,
    'src/components/SiteHeader.tsx':
      `interface SiteHeaderProps { activePath: string }\n` +
      `export function SiteHeader({ activePath }: SiteHeaderProps){ return <header><nav aria-label="Primary">` +
      pages
        .map(
          (page) =>
            `<a aria-current={activePath === '${page.route}' ? 'page' : undefined} href="${page.route}">${page.name}</a>`
        )
        .join('') +
      `</nav></header>; }`,
    'src/components/SiteFooter.tsx':
      `export function SiteFooter(){ return <footer><p>Studio, by appointment.</p></footer>; }`,
    'src/styles.css':
      `:focus-visible{outline:3px solid currentColor;outline-offset:2px}\n` +
      `@media (prefers-reduced-motion: reduce){*{animation:none;transition:none}}`
  };
  for (const page of pages)
    files[`src/pages/${componentName(page.id)}.tsx`] =
      `export function ${componentName(page.id)}(){ return <main><h1>${page.name}</h1>` +
      `<section><h2>${page.primaryMessage.slice(0, 40)}</h2><p>${page.userGoal.slice(0, 60)}</p></section>` +
      `</main>; }`;
  return files;
}

const raw = (files: Readonly<Record<string, string>>): RawGeneratedProject => ({
  files: Object.entries(files).map(([path, content]) => ({
    path,
    content,
    kind: path.endsWith('.css') ? 'stylesheet' : path.endsWith('.tsx') ? 'react' : 'typescript'
  }))
});
const singlePageFiles = compliantFiles(request);
const compliant = raw(singlePageFiles);
// One missing reduced-motion block: enough to fail the gate, small enough that a
// repair returning `compliant` is an obvious fix.
const brokenStyles = raw({
  ...singlePageFiles,
  'src/styles.css': ':focus-visible{outline:3px solid currentColor}'
});

// The design fixture compiles to a single-page plan, so the multi-route rules --
// route coverage, page modules, shared region extraction -- would never fire
// against it. selfCheck validates only the provider's output, not the request, so
// the gate cases run against a multi-page map that exercises all of them.
const gateRequest = requestWithPageMap(request, multiPageMap);
const gateRoutes = gateRequest.context.pageMap.pages.map((page) => page.route);
const gateFiles = compliantFiles(gateRequest);
const withFile = (path: string, content: string): RawGeneratedProject =>
  raw({ ...gateFiles, [path]: content });

// -- prompt assembly -------------------------------------------------------
// A plan field added upstream and ignored here is a silent failure: generation
// keeps succeeding while quietly disregarding part of the approved design.

test('the prompt carries every plan field the provider is responsible for', () => {
  const { system, user } = buildPrompt(request);
  for (const page of request.context.pageMap.pages) {
    assert.ok(user.includes(page.route), `missing route ${page.route}`);
    assert.ok(user.includes(page.userGoal), `missing user goal for ${page.route}`);
    assert.ok(user.includes(page.uniqueResponsibility), `missing responsibility ${page.route}`);
  }
  assert.ok(user.includes(request.context.typography.display));
  assert.ok(user.includes(request.context.typography.body));
  assert.ok(user.includes(request.context.colors.contrastStrategy));
  for (const role of request.context.colors.roles) assert.ok(user.includes(role.value));
  assert.ok(user.includes(request.context.composition.layoutFamily));
  assert.ok(user.includes(request.context.navigation.mode));
  for (const group of [
    request.context.prohibitedPatterns,
    request.context.protectedInvariants,
    request.context.implementationConstraints
  ]) {
    assert.ok(group.length > 0, 'fixture should exercise this field');
    for (const value of group) assert.ok(user.includes(value), `missing constraint: ${value}`);
  }
  // The traps a model walks into unprompted are worth naming explicitly.
  assert.match(system, /network-denial/);
  assert.match(system, /prohibited-pattern-resistance/);
  assert.match(system, /ARCH_ROUTE_PAGE_COVERAGE/);
  assert.match(system, /never emit `src\/main\.tsx`/i);
});

test('the repair prompt carries the previous attempt and the exact gaps', () => {
  const { user } = buildRepairPrompt(request, '{"files":[]}', [
    'reduced-motion: Reduced-motion behavior is missing.'
  ]);
  assert.ok(user.includes('{"files":[]}'));
  assert.ok(user.includes('Reduced-motion behavior is missing.'));
  // Still a full specification, so a rewrite cannot drift off the plan.
  assert.ok(user.includes(request.context.typography.display));
  assert.ok(user.includes(request.context.composition.layoutFamily));
});

// -- self check ------------------------------------------------------------
// Each case mirrors one gate check. Reusing reviewGeneratedImplementation means
// these also cover the architecture findings, which are what actually rejected
// generated work in practice.

test('a compliant project reports no gaps, single-page or multi-route', () => {
  assert.deepEqual(selfCheck(compliant, request), []);
  assert.deepEqual(selfCheck(raw(gateFiles), gateRequest), []);
});

test('each gate check surfaces as a gap naming the failure', () => {
  const lastRoute = gateRoutes[gateRoutes.length - 1]!;
  const cases: readonly [string, RawGeneratedProject, RegExp][] = [
    [
      'missing route',
      raw(
        Object.fromEntries(
          Object.entries(gateFiles).map(([path, content]) => [
            path,
            content.replaceAll(`'${lastRoute}'`, "'/elsewhere'").replaceAll(
              `"${lastRoute}"`,
              '"/elsewhere"'
            )
          ])
        )
      ),
      new RegExp(`page-map-coverage.*${lastRoute}`, 's')
    ],
    [
      'missing landmarks',
      raw({
        'src/App.tsx': 'export default function App(){ return <div>Only a div</div>; }',
        'src/styles.css': gateFiles['src/styles.css']!
      }),
      /semantic-navigation/
    ],
    [
      'no focus-visible',
      withFile('src/styles.css', '@media(prefers-reduced-motion:reduce){*{transition:none}}'),
      /visible-focus/
    ],
    [
      'no reduced-motion',
      withFile('src/styles.css', ':focus-visible{outline:2px solid}'),
      /reduced-motion/
    ],
    [
      'banned vocabulary in a comment',
      withFile(
        'src/data/content.ts',
        '// layout note: a bento arrangement of cards\nexport const items = [];'
      ),
      /prohibited-pattern-resistance/
    ],
    [
      'absolute URL in source',
      withFile(
        'src/data/content.ts',
        "export const hero = 'https://images.example.com/ridge.jpg';"
      ),
      /network-denial/
    ],
    [
      'route named in source but mapped to no page module',
      withFile(
        'src/App.tsx',
        `export default function App(){ return <><nav><a href="${gateRoutes[0]}">Home</a></nav>` +
          `<main><h1>Everything</h1><p>${gateRoutes.join(' ')}</p></main></>; }`
      ),
      /ARCH_ROUTE_PAGE_COVERAGE/
    ],
    [
      'untyped props on a reused component',
      withFile(
        'src/components/SiteHeader.tsx',
        `export function SiteHeader({ activePath }){ return <header><nav><a href="${gateRoutes[0]}">Home</a>{activePath}</nav></header>; }`
      ),
      /ARCH_TYPED_PROPS/
    ]
  ];
  for (const [label, project, expected] of cases) {
    const gaps = selfCheck(project, gateRequest);
    assert.ok(gaps.length > 0, `${label}: expected a gap`);
    assert.match(gaps.join('\n'), expected, label);
  }
});

test('a structurally rejected project reports the validation failure alone', () => {
  const gaps = selfCheck(withFile('src/main.tsx', 'export default null;'), gateRequest);
  assert.equal(gaps.length, 1);
  assert.match(gaps[0]!, /forbidden_file.*src\/main\.tsx/);
});

// -- provider orchestration ------------------------------------------------

class StubAdapter implements CliAdapter {
  readonly id = 'claude-code' as const;
  readonly executable = 'stub';
  readonly calls: CliRunInput[] = [];
  private readonly replies: readonly (string | Error)[];
  constructor(replies: readonly (string | Error)[]) {
    this.replies = replies;
  }
  async run(input: CliRunInput): Promise<string> {
    this.calls.push(input);
    const reply = this.replies[this.calls.length - 1];
    if (reply === undefined) throw new Error(`unexpected invocation ${this.calls.length}`);
    if (reply instanceof Error) throw reply;
    return reply;
  }
}
const generateWith = async (
  replies: readonly (string | Error)[],
  overrides: { timeoutMs?: number; signal?: AbortSignal } = {}
) => {
  const adapter = new StubAdapter(replies);
  const provider = new CliGenerationProvider({
    adapter,
    ...(overrides.timeoutMs === undefined ? {} : { timeoutMs: overrides.timeoutMs })
  });
  const result = await new ReactGenerator(provider).generate(request, overrides.signal);
  return { adapter, result };
};

test('a compliant first pass returns after exactly one invocation', async () => {
  const { adapter, result } = await generateWith([JSON.stringify(compliant)]);
  assert.equal(adapter.calls.length, 1);
  assert.ok(result.ok, result.ok ? '' : result.failure.message);
});

test('a gap triggers exactly one repair, carrying the gap text', async () => {
  const { adapter, result } = await generateWith([
    JSON.stringify(brokenStyles),
    JSON.stringify(compliant)
  ]);
  assert.equal(adapter.calls.length, 2);
  assert.match(adapter.calls[1]!.user, /reduced-motion/);
  assert.ok(result.ok, result.ok ? '' : result.failure.message);
});

test('a repair that still fails returns the flawed output without a third try', async () => {
  const { adapter, result } = await generateWith([
    JSON.stringify(brokenStyles),
    JSON.stringify(brokenStyles)
  ]);
  // An unbounded repair loop against a subscription is the expensive failure
  // mode, so the invocation ceiling matters more than the outcome here.
  assert.equal(adapter.calls.length, 2);
  // The provider does not suppress it: the review gate stays the authority.
  assert.ok(result.ok);
  assert.ok(!result.project.files.some((file) => /prefers-reduced-motion/.test(file.content)));
});

test('the whole call shares one time budget across both passes', async () => {
  const { adapter } = await generateWith(
    [JSON.stringify(brokenStyles), JSON.stringify(compliant)],
    { timeoutMs: 600_000 }
  );
  assert.equal(adapter.calls.length, 2);
  assert.ok(adapter.calls[0]!.deadlineMs <= 600_000);
  assert.ok(
    adapter.calls[1]!.deadlineMs <= adapter.calls[0]!.deadlineMs,
    'the repair must inherit what is left of the budget, not a fresh one'
  );
});

test('provider failures keep their code instead of collapsing to internal', async () => {
  const codes = [
    'authentication',
    'rate-limit',
    'timeout',
    'unavailable',
    'malformed-output'
  ] as const;
  for (const code of codes) {
    const { result } = await generateWith([new ProviderError(code, `stub ${code}`)]);
    assert.ok(!result.ok);
    assert.equal(result.failure.code, code, code);
  }
  const plain = await generateWith([new Error('boom')]);
  assert.ok(!plain.result.ok);
  assert.equal(plain.result.ok ? '' : plain.result.failure.code, 'internal');
});

test('an aborted signal outranks whatever the CLI reported', async () => {
  const controller = new AbortController();
  controller.abort();
  const { result } = await generateWith([new ProviderError('internal', 'killed')], {
    signal: controller.signal
  });
  assert.ok(!result.ok);
  assert.equal(result.failure.code, 'cancelled');
  assert.equal(result.failure.retryable, false);
});

test('non-JSON output fails as malformed rather than crashing', async () => {
  for (const reply of ['I cannot do that.', '```json\n{"nope":1}\n```'])
    assert.equal(
      (await generateWith([reply])).result.ok
        ? 'ok'
        : ((await generateWith([reply])).result as { failure: { code: string } }).failure.code,
      'malformed-output'
    );
});

test('JSON wrapped in prose or a fence is still accepted', async () => {
  const payload = JSON.stringify(compliant);
  for (const reply of [`Here you go:\n\`\`\`json\n${payload}\n\`\`\``, `Done.\n${payload}`]) {
    const { result } = await generateWith([reply]);
    assert.ok(result.ok, result.ok ? '' : result.failure.message);
  }
});

// -- adapters --------------------------------------------------------------
// Pure argv assembly, asserted without spawning anything.

test('claude code argv disables tools and pipes the system prompt', () => {
  const args = claudeCodeArgs({ system: 'SYSTEM', model: 'claude-opus-5' });
  assert.deepEqual(args, [
    '--print',
    '--output-format',
    'json',
    '--tools',
    '',
    '--append-system-prompt',
    'SYSTEM',
    '--model',
    'claude-opus-5'
  ]);
  assert.ok(!claudeCodeArgs({ system: 'SYSTEM' }).includes('--model'));
});

test('codex argv reads stdin, constrains the schema, and stays read-only', () => {
  const args = codexArgs({
    workspace: '/tmp/work',
    schemaPath: '/tmp/work/output-schema.json',
    outputPath: '/tmp/work/final-message.json'
  });
  assert.equal(args[0], 'exec');
  assert.equal(args[1], '-');
  for (const flag of ['--skip-git-repo-check', '--ephemeral', '--output-schema'])
    assert.ok(args.includes(flag), flag);
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('--output-last-message') + 1], '/tmp/work/final-message.json');
  assert.ok(!args.includes('--model'));
});

test('the claude envelope is unwrapped, and an unsuccessful one is malformed', () => {
  assert.equal(
    unwrapClaudeEnvelope(JSON.stringify({ subtype: 'success', is_error: false, result: '{}' })),
    '{}'
  );
  for (const envelope of [
    'not json',
    JSON.stringify({ subtype: 'error_max_turns', result: 'stopped' }),
    JSON.stringify({ subtype: 'success', result: 42 })
  ])
    assert.throws(() => unwrapClaudeEnvelope(envelope), ProviderError);
});

// -- configuration ---------------------------------------------------------

test('subscription providers need no API key, and unknown ids still fail', () => {
  assert.ok(isCliProviderId('claude-code') && isCliProviderId('codex'));
  assert.ok(!isCliProviderId('deterministic'));
  const factory = {
    create: () => new CliGenerationProvider({ adapter: new StubAdapter([]) })
  };
  const configured = createConfiguredGenerator(
    { UNIVERSAL_GENERATION_PROVIDER: 'claude-code' },
    factory
  );
  assert.equal(configured.live, true);
  assert.equal(configured.providerId, 'universal.cli-claude-code');
  assert.equal(configured.generator.capabilities.requiresCredentials, false);
  // An id the CLI factory does not recognise is still rejected, and the runtime
  // never treats an unknown provider as credential-free.
  assert.throws(
    () =>
      createConfiguredGenerator(
        {
          UNIVERSAL_GENERATION_PROVIDER: 'nonesuch',
          UNIVERSAL_PROVIDER_API_KEY: 'sk-test',
          UNIVERSAL_PROVIDER_MODEL: 'some-model'
        },
        cliProviderFactory
      ),
    /not installed/
  );
  // The default path must stay credential-free so `pnpm dev` needs no setup.
  assert.equal(createConfiguredGenerator({}).providerId, 'universal.deterministic-react');
});

test('the availability probe explains a missing CLI instead of failing at generation time', () => {
  const probe = probeCliProvider('codex', {
    UNIVERSAL_PROVIDER_CLI_PATH: '/nonexistent/codex'
  });
  assert.equal(probe.available, false);
  assert.match(probe.available ? '' : probe.reason, /not an executable file/);
});
