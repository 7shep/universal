// Proves the published tarball is self-contained: it carries only what a
// consumer needs, and the binary starts and serves tools from a directory that
// has no relationship to this monorepo.
//
// Runs offline. The five declared runtime dependencies are linked from the
// repository's own store rather than installed from the registry, so this test
// does not download Playwright or Sharp; what it verifies is that nothing
// *outside* those five is required.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const skillNames = [
  'accessibility',
  'animate',
  'art-direct',
  'assets',
  'audit',
  'cleanup',
  'color',
  'compare',
  'consistency',
  'copy',
  'critique',
  'document',
  'final-pass',
  'layout',
  'performance',
  'polish',
  'responsive',
  'review-ui',
  'states',
  'typography'
];

async function packToTemporary() {
  const staging = await mkdtemp(join(tmpdir(), 'universal-mcp-pack-'));
  const { stdout } = await run('pnpm', ['pack', '--pack-destination', staging], {
    cwd: packageRoot,
    shell: process.platform === 'win32'
  });
  const tarball = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.tgz'))
    .at(-1);
  assert.ok(tarball, `pnpm pack did not report a tarball:\n${stdout}`);
  return { staging, tarball: resolve(staging, tarball) };
}

async function listTarball(tarball) {
  const { stdout } = await run('tar', ['-tf', tarball]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^package\//, ''))
    .filter(Boolean);
}

test('the tarball carries the runtime files and nothing else', async () => {
  const { staging, tarball } = await packToTemporary();
  try {
    const entries = await listTarball(tarball);

    for (const required of [
      'package.json',
      'dist/index.js',
      'server.json',
      'README.md',
      'LICENSE.MD',
      'template/package.json',
      'template/vite.config.ts'
    ]) {
      assert.ok(entries.includes(required), `tarball is missing ${required}`);
    }
    assert.ok(
      entries.some((entry) => /^dist\/fake-.*\.txt$/.test(entry)),
      'tarball is missing the deterministic provider assets'
    );
    for (const name of skillNames) {
      assert.ok(
        entries.includes(`dist/skills/${name}/SKILL.md`),
        `tarball is missing the ${name} skill`
      );
    }

    // Source, tests, and build configuration are development-only.
    for (const entry of entries) {
      assert.ok(!entry.startsWith('src/'), `tarball should not ship source: ${entry}`);
      assert.ok(!entry.startsWith('scripts/'), `tarball should not ship build scripts: ${entry}`);
      assert.ok(!entry.includes('.test.'), `tarball should not ship tests: ${entry}`);
      assert.ok(entry !== 'tsconfig.json', 'tarball should not ship tsconfig.json');
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
});

test('the published manifest declares no private workspace dependency', () => {
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    assert.ok(
      !name.startsWith('@universal/'),
      `${name} is a private workspace package and cannot be a published dependency`
    );
    assert.ok(!range.startsWith('workspace:'), `${name} still uses a workspace protocol range`);
  }
  assert.equal(manifest.private, undefined, 'the package must not be private to be publishable');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.ok(manifest.license && manifest.repository && manifest.engines?.node);
});

test('the packed binary starts and serves tools outside the monorepo', async () => {
  const { staging, tarball } = await packToTemporary();
  const fixture = await mkdtemp(join(tmpdir(), 'universal-mcp-install-'));
  try {
    await run('tar', ['-xf', tarball, '-C', fixture]);
    const installed = join(fixture, 'package');

    // Link only the declared runtime dependencies. If the bundle reaches for
    // anything else — a workspace package, a monorepo source path — the server
    // fails to start and this test fails.
    const modules = join(installed, 'node_modules');
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const target = join(packageRoot, 'node_modules', name);
      const link = join(modules, name);
      await mkdir(dirname(link), { recursive: true });
      await symlink(target, link, 'junction');
    }

    const client = new Client({ name: 'universal-mcp-package-test', version: '0.1.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(installed, 'dist', 'index.js')],
        cwd: fixture
      })
    );
    try {
      const { tools } = await client.listTools();
      for (const name of ['start_art_direction', 'create_design_plan', 'get_design_rules']) {
        assert.ok(
          tools.some((tool) => tool.name === name),
          `installed server is missing MCP tool ${name}`
        );
      }

      // Exercise a tool so the bundled internals actually execute.
      const response = await client.callTool({
        name: 'create_design_plan',
        arguments: { prompt: 'Mechanical keyboard' }
      });
      assert.equal(response.isError, undefined);
      assert.match(JSON.stringify(response.content), /industrial/);
    } finally {
      await client.close();
    }

    // Nothing from the checkout may have been copied in alongside the package.
    assert.deepEqual((await readdir(fixture)).sort(), ['package']);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

test('the install-skills command installs and safely updates every bundled skill', async () => {
  const { staging, tarball } = await packToTemporary();
  const fixture = await mkdtemp(join(tmpdir(), 'universal-skills-install-'));
  try {
    await run('tar', ['-xf', tarball, '-C', fixture]);
    const installed = join(fixture, 'package');
    const modules = join(installed, 'node_modules');
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const target = join(packageRoot, 'node_modules', name);
      const link = join(modules, name);
      await mkdir(dirname(link), { recursive: true });
      await symlink(target, link, 'junction');
    }

    const project = join(fixture, 'consumer');
    await mkdir(project);
    const binary = join(installed, 'dist', 'index.js');
    const first = await run(process.execPath, [binary, 'install-skills'], { cwd: project });
    assert.match(first.stdout, /Installed 40 skill directories across 2 agent targets/);

    for (const root of ['.agents/skills', '.claude/skills']) {
      for (const name of skillNames) {
        await readFile(join(project, root, name, 'SKILL.md'), 'utf8');
      }
    }

    const sentinel = join(project, '.agents', 'skills', 'animate', 'SKILL.md');
    await writeFile(sentinel, 'preserve me', 'utf8');
    const second = await run(process.execPath, [binary, 'install-skills'], { cwd: project });
    assert.match(second.stdout, /Preserved 40 existing skill directories/);
    assert.equal(await readFile(sentinel, 'utf8'), 'preserve me');

    await run(process.execPath, [binary, 'install-skills', '--force'], { cwd: project });
    assert.notEqual(await readFile(sentinel, 'utf8'), 'preserve me');
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});
