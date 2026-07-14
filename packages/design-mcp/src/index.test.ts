import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createDesignPlan, getCompositionHistory, getDesignRules, resetCompositionHistory, selectPreset } from './design.js';
import { extractStructuralSignature, reviewImplementation } from './review.js';

test('selects industrial for a mechanical keyboard', () => {
  assert.equal(selectPreset({ prompt: 'A premium mechanical keyboard brand' }).name, 'industrial');
});
test('selects luxury for jewelry', () => {
  assert.equal(selectPreset({ prompt: 'A luxury jewelry house' }).name, 'luxury');
});
test('selects technical for developer infrastructure', () => {
  assert.equal(selectPreset({ prompt: 'Developer infrastructure for cloud teams' }).name, 'technical');
});
test('returns a complete, chosen plan', () => {
  resetCompositionHistory();
  const plan = createDesignPlan({ prompt: 'An editorial portfolio for an architect' });
  assert.equal(plan.preset, 'editorial');
  assert.equal(plan.pageStructure.length, 4);
  assert.ok(plan.avoid.includes('nested cards'));
  assert.ok(plan.heroComposition.regions.length >= 3);
  assert.ok(plan.navigation.id);
  assert.match(plan.implementationPrompt, /Follow the coordinates and relationships/i);
  assert.ok(plan.prohibitedPatterns.length > 0);
});
test('uses composition seeds deterministically when history is reset', () => {
  resetCompositionHistory();
  const first = createDesignPlan({ prompt:'A student AI organization', compositionSeed:42 });
  resetCompositionHistory();
  const second = createDesignPlan({ prompt:'A student AI organization', compositionSeed:42 });
  assert.deepEqual(first.compositionSignature, second.compositionSignature);
});
test('penalizes recent structural signatures', () => {
  resetCompositionHistory();
  const first = createDesignPlan({ prompt:'An editorial culture organization', compositionSeed:7 });
  const second = createDesignPlan({ prompt:'An editorial culture organization', compositionSeed:7 });
  assert.notDeepEqual(first.compositionSignature, second.compositionSignature);
  assert.equal(getCompositionHistory().length, 2);
});
test('adds an accessible layered scroll-motion direction when requested', () => {
  const plan = createDesignPlan({ prompt: 'A premium mechanical keyboard with a layered parallax exploded view on scroll' });
  assert.equal(plan.motionDirection?.trigger, 'scroll-driven');
  assert.match(plan.motionDirection?.signature ?? '', /exploded view/i);
  assert.match(plan.motionDirection?.reducedMotion ?? '', /static/i);
  assert.ok(plan.implementationNotes.some((note) => note.includes('prefers-reduced-motion')));
});
test('returns global design rules', () => {
  const rules = getDesignRules('landing page');
  assert.equal(rules.category, 'landing page');
  assert.ok(rules.antiPatterns.includes('nested cards'));
  assert.ok(rules.motionPrinciples.some((principle) => principle.includes('scroll-jack')));
});
test('warns about purple gradients', () => {
  const review = reviewImplementation([{ path: 'styles.css', content: '.hero { background: radial-gradient(circle, #8b5cf6, #111); }' }]);
  assert.ok(review.findings.some((finding) => finding.rule === 'unjustified-gradients'));
});
test('warns about repeated large radii and three-column grids', () => {
  const review = reviewImplementation([{ path: 'styles.css', content: '.a{border-radius:32px}.b{border-radius:32px}.c{border-radius:32px}.grid{display:grid;grid-template-columns:repeat(3,1fr)}' }]);
  assert.ok(review.findings.some((finding) => finding.rule === 'excessive-rounded-containers'));
  assert.ok(review.findings.some((finding) => finding.rule === 'standard-feature-grid'));
});
test('detects a default split hero and standard navigation', () => {
  const files = [{ path:'page.tsx', content:'<nav><div className="brand"/><div className="nav-links"/><a className="cta"/></nav><section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>' },{path:'styles.css',content:'.hero{display:grid;grid-template-columns:1.2fr .8fr}.nav{display:flex}.nav-links{margin-left:auto}'}];
  const signature = extractStructuralSignature(files);
  assert.equal(signature.heroArchetype, 'split-screen');
  assert.equal(signature.navigationMode, 'standard-horizontal');
  const review = reviewImplementation(files);
  assert.ok(review.findings.some((finding) => finding.rule === 'default-split-hero'));
  assert.ok(review.findings.some((finding) => finding.rule === 'default-horizontal-navigation'));
});
test('compares the implementation with the expected composition contract', () => {
  const files = [{path:'page.tsx',content:'<section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>'},{path:'styles.css',content:'.hero{display:grid;grid-template-columns:1fr 1fr}'}];
  const expected = { heroArchetype:'poster', navigationMode:'perimeter' as const, sectionSequence:['poster','story'], preset:'editorial' as const };
  const review = reviewImplementation(files, undefined, { expectedSignature: expected, recentSignatures:[expected] });
  assert.ok(review.findings.some((finding) => finding.rule === 'composition-contract-hero-mismatch'));
  assert.ok(review.findings.some((finding) => finding.rule === 'cross-run-structural-repetition'));
});
test('a clean editorial sample passes several rules', () => {
  const review = reviewImplementation([{ path: 'styles.css', content: '.hero { display:grid; grid-template-columns: 1.2fr .8fr; } .panel { border-radius: 6px; }' }]);
  assert.equal(review.status, 'revision_recommended');
  assert.ok(review.passedRules.length >= 4);
});

test('requires desktop and mobile visual evidence before a review can pass', () => {
  const files = [{ path: 'page.tsx', content: '<main><section className="hero">Direction</section></main>' }];
  const review = reviewImplementation(files, { screenshots: [{ viewport: 'desktop', location: 'hero-desktop.png' }], checkedForEmptySpace: true, checkedForMissingMedia: true });
  assert.ok(review.findings.some((finding) => finding.rule === 'visual-evidence-required'));
});

test('flags large visual regions without a purposeful visual asset', () => {
  const review = reviewImplementation([{ path: 'styles.css', content: '.hero-diagram { min-height: 440px; }' }], { screenshots: [{ viewport: 'desktop' }, { viewport: 'mobile' }], checkedForEmptySpace: true, checkedForMissingMedia: true });
  assert.ok(review.findings.some((finding) => finding.rule === 'likely-empty-visual-region'));
});

test('serves design tools over stdio', async () => {
  const client = new Client({ name: 'design-mcp-test', version: '0.1.0' });
  const serverPath = fileURLToPath(new URL('./index.js', import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === 'create_design_plan'));
    const response = await client.callTool({ name: 'create_design_plan', arguments: { prompt: 'Mechanical keyboard' } });
    assert.equal(response.isError, undefined);
    assert.match(JSON.stringify(response.content), /industrial/);
  } finally {
    await client.close();
  }
});
