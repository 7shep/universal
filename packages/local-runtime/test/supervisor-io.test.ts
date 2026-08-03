// The CLI generation adapters depend on two capabilities the supervisor did not
// originally have: piping a prompt too large for a Windows command line, and
// capturing a payload far larger than a build log. Both are silent when broken --
// a dropped prompt or a truncated payload both surface as "the model returned
// malformed JSON" -- so they are pinned here.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runSupervisedCommand } from '../src/process-supervisor.ts';

const workspace = await mkdtemp(path.join(os.tmpdir(), 'universal-supervisor-'));
const runNode = (script: string, overrides: Partial<Parameters<typeof runSupervisedCommand>[0]> = {}) =>
  runSupervisedCommand({
    command: process.execPath,
    args: ['-e', script],
    cwd: workspace,
    timeoutMs: 30_000,
    ...overrides
  });

test('stdin reaches the child and is closed', async () => {
  const result = await runNode(
    'let data="";process.stdin.on("data",c=>data+=c);process.stdin.on("end",()=>process.stdout.write(`got:${data.length}:${data.slice(0,5)}`));',
    { stdin: 'x'.repeat(50_000) }
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, `got:50000:${'x'.repeat(5)}`);
});

test('output beyond the default cap is captured when maxOutputBytes allows it', async () => {
  const script = 'process.stdout.write("y".repeat(200000));';
  const capped = await runNode(script);
  assert.ok(capped.truncated, 'the 64 KB default should still truncate');
  assert.ok(capped.stdout.length < 200_000);

  const raised = await runNode(script, { maxOutputBytes: 8 * 1024 * 1024 });
  assert.equal(raised.truncated, false);
  assert.equal(raised.stdout.length, 200_000);
});
