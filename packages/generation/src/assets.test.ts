import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_LIMITS, validateAssetManifest, type GeneratedAsset } from './index.ts';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const asset = (overrides: Partial<GeneratedAsset> = {}): GeneratedAsset => ({
  path: 'src/assets/mark.png',
  mediaType: 'image/png',
  encoding: 'base64',
  content: png,
  digest: 'placeholder',
  role: 'icon',
  provenance: { source: 'generated', generator: 'fixture-generator@1' },
  license: { identifier: 'CC0-1.0' },
  ...overrides
});

test('validates a provenance-aware raster manifest and records dimensions', () => {
  const result = validateAssetManifest([asset()]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.assets[0]?.dimensions, { width: 1, height: 1 });
  assert.equal(result.manifest.entries[0]?.provenance?.source, 'generated');
});

test('rejects media spoofing, active SVG, traversal, collisions, and unsafe attribution', () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://evil.test/x"/></svg>'
  ).toString('base64');
  const result = validateAssetManifest([
    asset({ path: 'src/assets/Mark.png' }),
    asset({ path: 'src/assets/mark.png', mediaType: 'image/jpeg' }),
    asset({
      path: 'src/assets/unsafe.svg',
      mediaType: 'image/svg+xml',
      content: svg,
      license: { identifier: 'custom', sourceUrl: 'http://insecure.test' }
    }),
    asset({ path: 'src/assets/../escape.png' })
  ]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  const codes = new Set(result.findings.map((item) => item.code));
  for (const code of [
    'ASSET_PATH_COLLISION',
    'ASSET_EXTENSION_MISMATCH',
    'ASSET_MEDIA_TYPE_MISMATCH',
    'ASSET_SVG_ACTIVE_CONTENT',
    'ASSET_LICENSE_INVALID',
    'ASSET_PATH_INVALID'
  ])
    assert.ok(codes.has(code), code);
});

test('enforces file-count, individual-size, total-size, and dimension limits', () => {
  const tooMany = validateAssetManifest(
    Array.from({ length: ASSET_LIMITS.maxFiles + 1 }, (_, index) =>
      asset({ path: `src/assets/${index}.png` })
    )
  );
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok)
    assert.ok(tooMany.findings.some((item) => item.code === 'ASSET_FILE_COUNT_EXCEEDED'));
  const hugeDimension = Buffer.from(png, 'base64');
  hugeDimension.writeUInt32BE(ASSET_LIMITS.maxDimension + 1, 16);
  const dimensions = validateAssetManifest([asset({ content: hugeDimension.toString('base64') })]);
  assert.equal(dimensions.ok, false);
  if (!dimensions.ok)
    assert.ok(dimensions.findings.some((item) => item.code === 'ASSET_DIMENSIONS_EXCEEDED'));
  const oversized = validateAssetManifest([
    asset({ content: Buffer.alloc(ASSET_LIMITS.maxFileBytes + 1, 1).toString('base64') })
  ]);
  assert.equal(oversized.ok, false);
  if (!oversized.ok)
    assert.ok(oversized.findings.some((item) => item.code === 'ASSET_FILE_SIZE_EXCEEDED'));
});
