import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createDesignPlan, getDesignRules, selectPreset } from './design.js';
import { reviewImplementation } from './review.js';

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
  const plan = createDesignPlan({ prompt: 'An editorial portfolio for an architect' });
  assert.equal(plan.preset, 'editorial');
  assert.equal(plan.pageStructure.length, 4);
  assert.ok(plan.avoid.includes('nested cards'));
});
test('returns global design rules', () => {
  const rules = getDesignRules('landing page');
  assert.equal(rules.category, 'landing page');
  assert.ok(rules.antiPatterns.includes('nested cards'));
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
test('a clean editorial sample passes several rules', () => {
  const review = reviewImplementation([{ path: 'styles.css', content: '.hero { display:grid; grid-template-columns: 1.2fr .8fr; } .panel { border-radius: 6px; }' }]);
  assert.equal(review.status, 'pass');
  assert.ok(review.passedRules.length >= 4);
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
