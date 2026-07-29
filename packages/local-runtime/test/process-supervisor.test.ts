import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
test('pre-aborted signals and spawn failures return structured, secret-safe failures', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
        cwd: process.cwd(),
        timeoutMs: 1_000,
        signal: controller.signal
      }),
    (error: unknown) =>
      error instanceof RuntimeFailure && error.detail.code === 'CANCELLED_OPERATION'
  );
  const secret = 'super-secret-command-token';
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: `missing-${secret}`,
        args: [],
        cwd: process.cwd(),
        timeoutMs: 1_000
      }),
    (error: unknown) =>
      error instanceof RuntimeFailure &&
      error.detail.code === 'INTERNAL_FAILURE' &&
      !error.message.includes(secret)
  );
});

test('cancellation races settle once and remove their timeout path', async () => {
  const controller = new AbortController();
  const result = runSupervisedCommand({
    command: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1_000)'],
    cwd: process.cwd(),
    timeoutMs: 40,
    signal: controller.signal
  });
  controller.abort();
  controller.abort();
  await assert.rejects(
    () => result,
    (error: unknown) =>
      error instanceof RuntimeFailure && error.detail.code === 'CANCELLED_OPERATION'
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
});

test(
  'natural exit while POSIX cancellation is draining still reports cancellation',
  { skip: process.platform === 'win32' },
  async () => {
    const controller = new AbortController();
    const result = runSupervisedCommand({
      command: process.execPath,
      args: [
        '-e',
        "process.on('SIGTERM', () => {});setTimeout(() => process.exit(0), 75);setInterval(() => {}, 1_000)"
      ],
      cwd: process.cwd(),
      timeoutMs: 1_000,
      signal: controller.signal
    });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(
      () => result,
      (error: unknown) =>
        error instanceof RuntimeFailure && error.detail.code === 'CANCELLED_OPERATION'
    );
  }
);

test('timeout terminates a spawned process tree', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-process-timeout-'));
  const pidFile = path.join(root, 'child.pid');
  const parent = `const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
  try {
    await assert.rejects(
      () =>
        runSupervisedCommand({
          command: process.execPath,
          args: ['-e', parent],
          cwd: root,
          timeoutMs: 100
        }),
      (error: unknown) => error instanceof RuntimeFailure && error.detail.code === 'TIMEOUT'
    );
    const pid = Number(await readFile(pidFile, 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    assert.equal(alive, false, `grandchild ${pid} survived timeout`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('observes aborts that race listener registration', async () => {
  let aborted = false;
  const signal = {
    get aborted() {
      return aborted;
    },
    addEventListener() {
      aborted = true;
    },
    removeEventListener() {}
  } as unknown as AbortSignal;
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1_000)'],
        cwd: process.cwd(),
        timeoutMs: 1_000,
        signal
      }),
    (error: unknown) =>
      error instanceof RuntimeFailure && error.detail.code === 'CANCELLED_OPERATION'
  );
});
