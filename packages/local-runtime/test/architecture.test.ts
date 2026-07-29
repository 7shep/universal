import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import { createProjectGenerationRequest } from '@universal/generation';
import { analyzeReactArchitecture } from '../src/architecture.ts';
import { reviewGeneratedImplementation } from '../src/review.ts';
import {
  multiPageMap,
  organizedFiles,
  project,
  requestWithPageMap,
  singlePageMap
} from './architecture-fixtures.ts';

const plan = compileDesignPlanV2({
  brief: fixtureCreativeBrief,
  evaluation: fixtureSelectedDirectionEvaluation,
  providerOutput: serializedFixtureDesignPlanV2Draft,
  now: '2026-07-28T12:10:00.000Z'
});
const baseRequest = createProjectGenerationRequest({
  projectId: 'project:architecture',
  revisionId: 'revision:architecture:1',
  designPlan: plan
});
const analyze = (files: Readonly<Record<string, string>>, pageMap = multiPageMap) =>
  analyzeReactArchitecture(project(files), requestWithPageMap(baseRequest, pageMap));

test('rejects a compiling monolithic multi-route App.tsx', () => {
  const result = analyze({
    'src/App.tsx': `const route=window.location.pathname; function Home(){return <main><h1>Home</h1><section><h2>One</h2><p>A</p></section></main>} function Expedition(){return <main><h1>Expedition</h1><section><h2>Two</h2><p>B</p></section></main>} function Notes(){return <main><h1>Notes</h1><section><h2>Three</h2><p>C</p></section></main>} export default function App(){return <><nav><a href="/">Home</a><a href="/expedition">Expedition</a><a href="/field-notes">Notes</a></nav>{route==='/'?<Home/>:route==='/expedition'?<Expedition/>:<Notes/>}<footer>End</footer></>}`,
    'src/styles.css': ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){}'
  });
  assert.ok(result.findings.some((finding) => finding.id === 'ARCH_APP_MONOLITH'));
  assert.ok(result.findings.some((finding) => finding.id === 'ARCH_PAGE_MODULES_REQUIRED'));
  assert.ok(result.findings.some((finding) => finding.id === 'ARCH_APP_MULTIPLE_PAGES'));
});

test('passes an organized multi-route project and recognizes shared layout and typed props', () => {
  const result = analyze(organizedFiles);
  assert.deepEqual(
    result.findings.filter((finding) => finding.severity === 'error'),
    []
  );
  assert.deepEqual(result.evidence.pageModules, [
    'src/pages/ExpeditionPage.tsx',
    'src/pages/FieldNotesPage.tsx',
    'src/pages/HomePage.tsx'
  ]);
  assert.deepEqual(result.evidence.sharedComponents, [
    'src/components/SiteFooter.tsx',
    'src/components/SiteHeader.tsx'
  ]);
  assert.deepEqual(result.evidence.props.untyped, []);
  assert.ok(result.evidence.props.typed.includes('src/components/SiteHeader.tsx#SiteHeader'));
});

test('recognizes page modules in object-based route configuration', () => {
  const files = {
    ...organizedFiles,
    'src/App.tsx': `import { SiteHeader } from './components/SiteHeader'; import { SiteFooter } from './components/SiteFooter'; import { HomePage } from './pages/HomePage'; import { ExpeditionPage } from './pages/ExpeditionPage'; import { FieldNotesPage } from './pages/FieldNotesPage'; const routes = [{ path: '/', element: <HomePage/> }, { path: '/expedition', element: <ExpeditionPage/> }, { path: '/field-notes', element: <FieldNotesPage/> }]; export default function App(){ const page = routes.find(route => route.path === window.location.pathname)?.element ?? <HomePage/>; return <><SiteHeader activePath={window.location.pathname}/>{page}<SiteFooter/></>; }`
  };
  assert.deepEqual(analyze(files).evidence.routeMappings, {
    '/': 'src/pages/HomePage.tsx',
    '/expedition': 'src/pages/ExpeditionPage.tsx',
    '/field-notes': 'src/pages/FieldNotesPage.tsx'
  });
});
test('requires every approved route to resolve to a page module', () => {
  const files = {
    ...organizedFiles,
    'src/App.tsx': organizedFiles['src/App.tsx']!.replace(
      "'/field-notes': FieldNotesPage",
      "'/other': FieldNotesPage"
    )
  };
  const finding = analyze(files).findings.find((item) => item.id === 'ARCH_ROUTE_PAGE_COVERAGE');
  assert.equal(finding?.severity, 'error');
  assert.deepEqual(
    (finding?.evidence.routeMappings as Record<string, string | null>)['/field-notes'],
    null
  );
});

test('untyped configurable components fail while typed props pass', () => {
  const files = {
    ...organizedFiles,
    'src/components/SiteHeader.tsx': `export function SiteHeader({ activePath }){ return <header><strong>North</strong><nav><a href="/">{activePath}</a></nav></header>; }`
  };
  assert.ok(analyze(files).findings.some((finding) => finding.id === 'ARCH_TYPED_PROPS'));
  assert.ok(!analyze(organizedFiles).findings.some((finding) => finding.id === 'ARCH_TYPED_PROPS'));
});

test('meaningless micro-components do not satisfy a substantial single-page plan', () => {
  const result = analyze(
    {
      'src/App.tsx': `export default function App(){return <main><h1>Title</h1><section><h2>A</h2><p>A</p></section><section><h2>B</h2><p>B</p></section><section><h2>C</h2><p>C</p></section><section><h2>D</h2><p>D</p></section></main>}`,
      'src/components/One.tsx': `export function One(){return <span>one</span>}`,
      'src/components/Two.tsx': `export function Two(){return <span>two</span>}`,
      'src/styles.css': ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){}'
    },
    singlePageMap(['hero', 'work', 'about', 'contact'])
  );
  assert.ok(result.findings.some((finding) => finding.id === 'ARCH_APP_MONOLITH'));
});

test('detects substantial duplicated JSX across modules', () => {
  const duplicate = `<section><header><h2>Record</h2><p>Lead</p></header><article><h3>Detail</h3><p>Body</p><ul><li><span>Fact</span></li></ul></article></section>`;
  const files = {
    ...organizedFiles,
    'src/pages/HomePage.tsx': `export function HomePage(){return <main><h1>Home</h1>${duplicate}</main>}`,
    'src/pages/ExpeditionPage.tsx': `export function ExpeditionPage(){return <main><h1>Expedition</h1>${duplicate}</main>}`
  };
  assert.ok(analyze(files).findings.some((finding) => finding.id === 'ARCH_DUPLICATED_JSX'));
});

test('allows a small legitimate single-page implementation without architecture errors', () => {
  const result = analyze(
    {
      'src/App.tsx': `export default function App(){return <><nav><a href="/">Home</a></nav><main><h1>Hello</h1><p>Small and complete.</p></main></>}`,
      'src/styles.css': ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){}'
    },
    singlePageMap(['intro'])
  );
  assert.deepEqual(
    result.findings.filter((finding) => finding.severity === 'error'),
    []
  );
});

test('reports large inline data and weak stylesheet organization as warnings', () => {
  const values = Array.from({ length: 8 }, (_, index) => `'item-${index}'`).join(',');
  const css = Array.from(
    { length: 20 },
    (_, index) => `.rule-${index}{color:red;padding:${index}px}`
  )
    .join('\n')
    .padEnd(1700, ' ');
  const files = {
    ...organizedFiles,
    'src/pages/HomePage.tsx': `const items=[${values}]; export function HomePage(){return <main><h1>Home</h1><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></main>}`,
    'src/styles.css': `${css}:focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){}`,
    'src/styles/components.css': undefined
  } as unknown as Record<string, string>;
  delete files['src/styles/components.css'];
  const result = analyze(files);
  assert.equal(
    result.findings.find((finding) => finding.id === 'ARCH_INLINE_DATA')?.severity,
    'warning'
  );
  assert.equal(
    result.findings.find((finding) => finding.id === 'ARCH_STYLESHEET_ORGANIZATION')?.severity,
    'warning'
  );
  const review = reviewGeneratedImplementation(
    project(files),
    requestWithPageMap(baseRequest, multiPageMap),
    '2026-07-28T12:20:00.000Z'
  );
  assert.equal(review.status, 'pass');
  assert.ok(
    review.checks.some(
      (check) => check.id === 'ARCH_STYLESHEET_ORGANIZATION' && check.severity === 'warning'
    )
  );
});
