import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  DESIGN_ORCHESTRATION_API_VERSION,
  validateDesignPlan,
  type CreateDesignPlanInput,
  type DesignOrchestrator
} from '@universal/design-engine';
import { fixturePlan } from '@universal/design-engine/fixtures';
import { createDesignMcpAdapter } from './design.js';

test('design adapter delegates plan development to the injected engine', async () => {
  const expected = fixturePlan;
  let received: unknown;
  const orchestrator: DesignOrchestrator = {
    version: DESIGN_ORCHESTRATION_API_VERSION,
    validatePlan: validateDesignPlan,
    async developPlan(request) {
      received = request;
      return {
        plan: expected,
        session: {
          compositionHistory: [...request.session.compositionHistory, expected.compositionSignature]
        }
      };
    }
  };
  const adapter = createDesignMcpAdapter(orchestrator);
  const input: CreateDesignPlanInput = {
    prompt: 'Mechanical keyboard',
    compositionSeed: 42,
    recentSignatures: [expected.compositionSignature]
  };

  assert.equal(await adapter.createDesignPlan(input), expected);
  assert.deepEqual(received, {
    brief: { prompt: 'Mechanical keyboard', compositionSeed: 42 },
    session: { compositionHistory: [expected.compositionSignature] }
  });
});

test('serves compatible public design tools over stdio', async () => {
  const client = new Client({ name: 'design-mcp-test', version: '0.1.0' });
  const serverPath = fileURLToPath(new URL('./index.js', import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === 'create_design_plan'));
    assert.ok(tools.tools.some((tool) => tool.name === 'get_design_rules'));
    assert.ok(tools.tools.some((tool) => tool.name === 'get_taste_profile'));
    assert.ok(tools.tools.some((tool) => tool.name === 'review_implementation'));

    const response = await client.callTool({
      name: 'create_design_plan',
      arguments: { prompt: 'Mechanical keyboard' }
    });
    assert.equal(response.isError, undefined);
    assert.match(JSON.stringify(response.content), /industrial/);
  } finally {
    await client.close();
  }
});
