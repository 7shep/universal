import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runSupervisedCommand, RuntimeFailure } from '../src/index.ts';

test('cancellation and timeout terminate supervised commands', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 80);
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: process.execPath,
        args: ['-e', 'setInterval(()=>{},1000)'],
        cwd: process.cwd(),
        timeoutMs: 5000,
        signal: controller.signal
      }),
    (error: unknown) =>
      error instanceof RuntimeFailure && error.detail.code === 'CANCELLED_OPERATION'
  );
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: process.execPath,
        args: ['-e', 'setInterval(()=>{},1000)'],
        cwd: process.cwd(),
        timeoutMs: 80
      }),
    (error: unknown) => error instanceof RuntimeFailure && error.detail.code === 'TIMEOUT'
  );
});
test('cancellation terminates the complete child process tree', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-process-')),
    pidFile = path.join(root, 'child.pid');
  const parent = `const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(() =>
    runSupervisedCommand({
      command: process.execPath,
      args: ['-e', parent],
      cwd: root,
      timeoutMs: 5000,
      signal: controller.signal
    })
  );
  const pid = Number(await readFile(pidFile, 'utf8'));
  await new Promise((resolve) => setTimeout(resolve, 300));
  let alive = true;
  try {
    process.kill(pid, 0);
  } catch {
    alive = false;
  }
  assert.equal(alive, false, `grandchild ${pid} survived cancellation`);
});
