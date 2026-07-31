// Produces the published entrypoint and the runtime assets it reads from disk.
//
// Universal's internal packages (@universal/*) are private workspace packages and
// are not published, so a consumer installing this tarball must not need them.
// They are bundled in. Only genuine runtime dependencies declared in
// `dependencies` stay external, so npm resolves them normally.
//
// Two of those bundled packages read files relative to their own module URL:
//
//   @universal/local-runtime   ../template/          (the fixed project template)
//   @universal/generation      ./fake-*.txt          (deterministic provider sources)
//
// After bundling, `import.meta.url` is `<package>/dist/index.js`, so those two
// specifiers resolve to `<package>/template/` and `<package>/dist/`. This script
// copies each asset to exactly that place and then asserts it landed there, so a
// layout change fails the build instead of failing a user's first run.
import { build } from 'esbuild';
import { chmod, cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const distRoot = resolve(packageRoot, 'dist');
const templateOut = resolve(packageRoot, 'template');

const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const external = Object.keys(manifest.dependencies ?? {});
const outfile = resolve(distRoot, 'index.js');

await mkdir(distRoot, { recursive: true });
const result = await build({
  entryPoints: [resolve(packageRoot, 'src/index.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
  metafile: true
});

// Anything left unbundled must be a declared dependency, or the published
// package will fail to start outside this repository.
const undeclared = [
  ...new Set(
    Object.values(result.metafile.outputs)
      .flatMap((output) => output.imports ?? [])
      .filter((entry) => entry.external)
      .map((entry) => entry.path)
      .filter((path) => !path.startsWith('node:'))
      .filter((path) => !external.some((name) => path === name || path.startsWith(`${name}/`)))
  )
].sort();
if (undeclared.length > 0) {
  throw new Error(`Bundle left undeclared external imports: ${undeclared.join(', ')}`);
}

await rm(templateOut, { recursive: true, force: true });
await cp(resolve(repoRoot, 'packages/local-runtime/template'), templateOut, { recursive: true });

const generationSource = resolve(repoRoot, 'packages/generation/src');
const providerAssets = (await readdir(generationSource)).filter((name) => name.endsWith('.txt'));
for (const name of providerAssets) {
  await cp(resolve(generationSource, name), resolve(distRoot, name));
}

const required = [
  resolve(templateOut, 'package.json'),
  resolve(templateOut, 'vite.config.ts'),
  ...providerAssets.map((name) => resolve(distRoot, name))
];
for (const path of required) {
  await stat(path).catch(() => {
    throw new Error(`Expected runtime asset is missing after bundling: ${path}`);
  });
}
if (providerAssets.length === 0) throw new Error('No deterministic provider assets were copied.');

await chmod(outfile, 0o755);
console.log(`bundled ${outfile} with ${providerAssets.length} provider assets and the template`);
