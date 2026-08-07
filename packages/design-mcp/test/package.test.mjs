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
import { basename, dirname, join, resolve } from 'node:path';
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

// GNU tar treats an argument like `C:\foo\bar.tgz` as a `host:path` remote
// archive spec (the same syntax rsync/older tar use for remote transport),
// so an absolute Windows path passed to `-f` makes it attempt a network
// connection instead of reading the local file (`tar: Cannot connect to C:
// resolve failed`). Running tar with its cwd set to the archive's directory
// and passing just the basename avoids the leading `X:` entirely. This is a
// plain relative path, so it behaves identically on macOS/Linux tar.
async function listTarball(tarball) {
  const { stdout } = await run('tar', ['-tf', basename(tarball)], { cwd: dirname(tarball) });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^package\//, ''))
    .filter(Boolean);
}

async function extractTarball(tarball, destination) {
  // See listTarball above for the `-f` argument. The `-C` destination has a
  // second, separate Windows-only problem: Node's child_process spawns the
  // (MSYS-built) tar.exe directly, so Windows' argv-to-command-line quoting
  // runs instead of a POSIX shell's. MSYS's own argument parser then reads
  // backslashes in that command line as escape characters and silently
  // drops them (`C:\Users\...` becomes `C:Users...`), so tar looks for a
  // mangled, nonexistent directory. GNU tar accepts forward slashes on
  // Windows identically to backslashes, and every POSIX tar already expects
  // them, so normalizing to `/` sidesteps the escaping and is a no-op on
  // macOS/Linux.
  const posixDestination = destination.split('\\').join('/');
  await run('tar', ['-xf', basename(tarball), '-C', posixDestination], { cwd: dirname(tarball) });
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
    await extractTarball(tarball, fixture);
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

async function stageInstalledPackage(fixture) {
  const { staging, tarball } = await packToTemporary();
  await extractTarball(tarball, fixture);
  const installed = join(fixture, 'package');
  const modules = join(installed, 'node_modules');
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const target = join(packageRoot, 'node_modules', name);
    const link = join(modules, name);
    await mkdir(dirname(link), { recursive: true });
    await symlink(target, link, 'junction');
  }
  return { staging, installed };
}

test('the install-skills command installs and safely updates every bundled skill (--target=both)', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'universal-skills-install-'));
  const { staging, installed } = await stageInstalledPackage(fixture);
  try {
    const project = join(fixture, 'consumer');
    await mkdir(project);
    const binary = join(installed, 'dist', 'index.js');
    const expectedPerTarget = skillNames.length;

    const first = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    assert.match(first.stdout, /Target agents \(.*\.agents[\\/]skills\):/);
    assert.match(first.stdout, /Target claude \(.*\.claude[\\/]skills\):/);
    const installedMatches = first.stdout.match(/Installed \d+ skill director/g) ?? [];
    assert.equal(
      installedMatches.length,
      2,
      `expected two "Installed" lines, got:\n${first.stdout}`
    );
    assert.match(first.stdout, new RegExp(`Installed ${expectedPerTarget} skill directories`, 'g'));

    for (const root of ['.agents/skills', '.claude/skills']) {
      for (const name of skillNames) {
        await readFile(join(project, root, name, 'SKILL.md'), 'utf8');
      }
    }

    // A re-run with nothing changed must not claim to have written anything.
    const second = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    const unchangedMatches =
      second.stdout.match(
        new RegExp(`Already up to date: ${expectedPerTarget} skill director`, 'g')
      ) ?? [];
    assert.equal(
      unchangedMatches.length,
      2,
      `expected two "Already up to date" lines, got:\n${second.stdout}`
    );
    assert.doesNotMatch(second.stdout, /Updated \d+ skill director/);
    assert.doesNotMatch(second.stdout, /Preserved \d+ skill director/);

    // A newer bundled skill must reach an installation the user has not touched.
    await writeFile(join(installed, 'dist', 'skills', 'animate', 'SKILL.md'), 'bundled v2', 'utf8');
    const third = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    const updatedMatches =
      third.stdout.match(/Updated 1 skill directory to the bundled version/g) ?? [];
    assert.equal(updatedMatches.length, 2, `expected two "Updated" lines, got:\n${third.stdout}`);
    for (const root of ['.agents/skills', '.claude/skills']) {
      assert.equal(
        await readFile(join(project, root, 'animate', 'SKILL.md'), 'utf8'),
        'bundled v2'
      );
    }

    // A locally edited skill must survive that same upgrade path.
    const sentinel = join(project, '.agents', 'skills', 'color', 'SKILL.md');
    await writeFile(sentinel, 'preserve me', 'utf8');
    const fourth = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    assert.match(fourth.stdout, /Preserved 1 skill directory with local edits/);
    assert.equal(await readFile(sentinel, 'utf8'), 'preserve me');

    // An incomplete directory is repaired rather than preserved forever.
    const broken = join(project, '.agents', 'skills', 'layout');
    await rm(join(broken, 'SKILL.md'));
    const fifth = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    assert.match(fifth.stdout, /Updated 1 skill directory to the bundled version/);
    await readFile(join(broken, 'SKILL.md'), 'utf8');

    // --force is the documented escape hatch that discards local edits.
    await run(process.execPath, [binary, 'install-skills', '--target=both', '--force'], {
      cwd: project
    });
    assert.notEqual(await readFile(sentinel, 'utf8'), 'preserve me');
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

test('install-skills autodetects the target from existing agent directories', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'universal-skills-autodetect-'));
  const { staging, installed } = await stageInstalledPackage(fixture);
  try {
    const binary = join(installed, 'dist', 'index.js');

    // Neither .agents nor .claude exists yet: falls back to .agents/skills alone.
    const freshProject = join(fixture, 'fresh');
    await mkdir(freshProject);
    const freshRun = await run(process.execPath, [binary, 'install-skills'], { cwd: freshProject });
    assert.match(freshRun.stdout, /Target agents \(/);
    assert.doesNotMatch(freshRun.stdout, /Target claude \(/);
    await readFile(join(freshProject, '.agents', 'skills', 'accessibility', 'SKILL.md'), 'utf8');
    await assert.rejects(readFile(join(freshProject, '.claude'), 'utf8'));

    // A project that already has a .claude directory (but not .agents) gets only .claude/skills.
    const claudeOnlyProject = join(fixture, 'claude-only');
    await mkdir(join(claudeOnlyProject, '.claude'), { recursive: true });
    const claudeRun = await run(process.execPath, [binary, 'install-skills'], {
      cwd: claudeOnlyProject
    });
    assert.match(claudeRun.stdout, /Target claude \(/);
    assert.doesNotMatch(claudeRun.stdout, /Target agents \(/);
    await readFile(
      join(claudeOnlyProject, '.claude', 'skills', 'accessibility', 'SKILL.md'),
      'utf8'
    );
    await assert.rejects(readFile(join(claudeOnlyProject, '.agents', 'skills'), 'utf8'));

    // A project with both directories already present gets both, matching pre-existing installs.
    const bothProject = join(fixture, 'both');
    await mkdir(join(bothProject, '.agents'), { recursive: true });
    await mkdir(join(bothProject, '.claude'), { recursive: true });
    const bothRun = await run(process.execPath, [binary, 'install-skills'], { cwd: bothProject });
    assert.match(bothRun.stdout, /Target agents \(/);
    assert.match(bothRun.stdout, /Target claude \(/);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

test('install-skills --dry-run reports without writing anything', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'universal-skills-dryrun-'));
  const { staging, installed } = await stageInstalledPackage(fixture);
  try {
    const binary = join(installed, 'dist', 'index.js');
    const project = join(fixture, 'consumer');
    await mkdir(project);

    const dry = await run(
      process.execPath,
      [binary, 'install-skills', '--target=both', '--dry-run'],
      { cwd: project }
    );
    assert.match(dry.stdout, /\[dry run\] Would install \d+ skill director/);

    // Nothing landed: no skill directories, no manifest, not even the target roots.
    assert.deepEqual(await readdir(project), []);

    // A real run afterwards behaves exactly as if the dry run never happened.
    const real = await run(process.execPath, [binary, 'install-skills', '--target=both'], {
      cwd: project
    });
    assert.match(real.stdout, /Installed \d+ skill director/);
    await readFile(join(project, '.agents', 'skills', 'accessibility', 'SKILL.md'), 'utf8');
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

test('install-skills --cwd installs into the given directory instead of process.cwd()', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'universal-skills-cwd-'));
  const { staging, installed } = await stageInstalledPackage(fixture);
  try {
    const binary = join(installed, 'dist', 'index.js');
    const project = join(fixture, 'target-project');
    await mkdir(project);

    // Run from `installed` but point --cwd at `project`.
    await run(process.execPath, [binary, 'install-skills', '--target=agents', `--cwd=${project}`], {
      cwd: installed
    });
    await readFile(join(project, '.agents', 'skills', 'accessibility', 'SKILL.md'), 'utf8');
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});
