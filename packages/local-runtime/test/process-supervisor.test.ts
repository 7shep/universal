import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isPnpmToolchainAvailable, runSupervisedCommand, RuntimeFailure } from '../src/index.ts';

test('pnpm toolchain preflight finds a shell-free entrypoint on PATH', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-pnpm-preflight-'));
  const originalPath = process.env.PATH,
    originalNpmExecpath = process.env.npm_execpath,
    originalPnpmHome = process.env.PNPM_HOME;
  try {
    await writeFile(path.join(root, 'pnpm.cjs'), '// fake pnpm entrypoint for the preflight test');
    delete process.env.npm_execpath;
    delete process.env.PNPM_HOME;
    process.env.PATH = root;
    assert.equal(await isPnpmToolchainAvailable(), true);
  } finally {
    process.env.PATH = originalPath;
    if (originalNpmExecpath === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = originalNpmExecpath;
    if (originalPnpmHome === undefined) delete process.env.PNPM_HOME;
    else process.env.PNPM_HOME = originalPnpmHome;
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'pnpm toolchain preflight reports unavailable on win32 with no resolvable entrypoint',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'universal-pnpm-preflight-missing-'));
    const originalPath = process.env.PATH,
      originalNpmExecpath = process.env.npm_execpath,
      originalPnpmHome = process.env.PNPM_HOME;
    try {
      delete process.env.npm_execpath;
      delete process.env.PNPM_HOME;
      process.env.PATH = root;
      assert.equal(await isPnpmToolchainAvailable(), false);
    } finally {
      process.env.PATH = originalPath;
      if (originalNpmExecpath === undefined) delete process.env.npm_execpath;
      else process.env.npm_execpath = originalNpmExecpath;
      if (originalPnpmHome === undefined) delete process.env.PNPM_HOME;
      else process.env.PNPM_HOME = originalPnpmHome;
      await rm(root, { recursive: true, force: true });
    }
  }
);

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
  const result = runSupervisedCommand({
    command: process.execPath,
    args: ['-e', parent],
    cwd: root,
    timeoutMs: 5_000,
    signal: controller.signal
  });
  let pid = 0;
  for (let attempt = 0; attempt < 40 && pid === 0; attempt += 1) {
    try {
      pid = Number((await readFile(pidFile, 'utf8')).trim());
    } catch {
      // The parent may still be creating the PID file on a busy Windows runner.
    }
    if (pid === 0) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  controller.abort();
  await assert.rejects(() => result);
  assert.ok(pid > 0, 'expected the parent to record a child PID');
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
          timeoutMs: 500
        }),
      (error: unknown) => error instanceof RuntimeFailure && error.detail.code === 'TIMEOUT'
    );
    let pid = 0;
    for (let attempt = 0; attempt < 20 && pid === 0; attempt += 1) {
      try {
        pid = Number((await readFile(pidFile, 'utf8')).trim());
      } catch {
        // The parent may still be creating the PID file on a busy Windows runner.
      }
      if (pid === 0) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(pid > 0, 'expected the parent to record a child PID');
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

test('collects bounded output through stream close', async () => {
  const result = await runSupervisedCommand({
    command: process.execPath,
    args: [
      '-e',
      "process.stdout.write('a'.repeat(70_000));process.stderr.write('b'.repeat(70_000));"
    ],
    cwd: process.cwd(),
    timeoutMs: 5_000
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 64 * 1024);
  assert.ok(Buffer.byteLength(result.stderr) <= 64 * 1024);
});

test('asynchronous spawn failures settle with a secret-safe structured failure', async () => {
  const secret = 'secret-invalid-working-directory';
  await assert.rejects(
    () =>
      runSupervisedCommand({
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
        cwd: path.join(os.tmpdir(), secret),
        timeoutMs: 1_000
      }),
    (error: unknown) =>
      error instanceof RuntimeFailure &&
      error.detail.code === 'INTERNAL_FAILURE' &&
      !error.message.includes(secret)
  );
});

test('natural completion remains successful when cancellation arrives afterwards', async () => {
  const controller = new AbortController();
  const result = await runSupervisedCommand({
    command: process.execPath,
    args: ['-e', "process.stdout.write('complete')"],
    cwd: process.cwd(),
    timeoutMs: 1_000,
    signal: controller.signal
  });
  controller.abort();
  assert.deepEqual(result, {
    exitCode: 0,
    stdout: 'complete',
    stderr: '',
    truncated: false
  });
});

test(
  'POSIX timeout terminates an inherited-stream descendant after its group leader exits',
  { skip: process.platform === 'win32', timeout: 10_000 },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'universal-process-leader-exit-'));
    const pidFile = path.join(root, 'child.pid');
    const parent = `const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});writeFileSync(${JSON.stringify(pidFile)},String(c.pid));process.exit(0);`;
    try {
      await assert.rejects(
        () =>
          runSupervisedCommand({
            command: process.execPath,
            args: ['-e', parent],
            cwd: root,
            timeoutMs: 300
          }),
        (error: unknown) => error instanceof RuntimeFailure && error.detail.code === 'TIMEOUT'
      );
      const pid = Number((await readFile(pidFile, 'utf8')).trim());
      assert.ok(pid > 0, 'expected the parent to record a descendant PID');
      await new Promise((resolve) => setTimeout(resolve, 100));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      assert.equal(alive, false, `descendant ${pid} survived timeout`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);
