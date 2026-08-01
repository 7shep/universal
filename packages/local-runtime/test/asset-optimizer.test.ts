import assert from 'node:assert/strict';
import test from 'node:test';
import { createFont, woff2 } from 'fonteditor-core';
import sharp from 'sharp';
import type { GeneratedAsset } from '@universal/generation';
import { optimizeAssetManifest, TRUSTED_ASSET_CODEC_VERSION } from '../src/index.ts';

const asAsset = (
  path: string,
  mediaType: string,
  content: Uint8Array,
  extra: Partial<GeneratedAsset> = {}
): GeneratedAsset => ({
  path,
  mediaType,
  encoding: 'base64',
  content: Buffer.from(content).toString('base64'),
  digest: 'source-digest',
  ...extra
});

test('re-encodes raster assets deterministically and creates bounded responsive variants', async () => {
  const source = await sharp({
    create: {
      width: 1400,
      height: 700,
      channels: 4,
      background: { r: 120, g: 40, b: 200, alpha: 0.75 }
    }
  })
    .png({ compressionLevel: 1 })
    .withMetadata({ orientation: 1 })
    .toBuffer();
  const input = [
    asAsset('src/assets/hero.png', 'image/png', source, {
      role: 'image',
      responsiveGroup: 'hero',
      dimensions: { width: 1400, height: 700 },
      provenance: { source: 'supplied', sourceDigest: 'original' }
    })
  ];
  const left = await optimizeAssetManifest(input);
  const right = await optimizeAssetManifest(input);
  assert.equal(left.ok, true);
  assert.deepEqual(left, right);
  if (!left.ok) return;
  assert.equal(left.codecVersion, TRUSTED_ASSET_CODEC_VERSION);
  assert.deepEqual(
    left.assets.map((asset) => asset.path),
    ['src/assets/hero.png', 'src/assets/hero-w640.png', 'src/assets/hero-w1280.png']
  );
  assert.deepEqual(left.assets[1]?.dimensions, { width: 640, height: 320 });
  assert.equal(left.assets[0]?.provenance?.source, 'supplied');
  assert.match(left.assets[0]?.provenance?.transformer ?? '', /trusted-asset-codec/);
  assert.ok(Buffer.from(left.assets[0]!.content, 'base64').byteLength < source.byteLength);
});

test('parses and deterministically rewrites TrueType and WOFF2 fonts', async () => {
  const font = createFont();
  const ttf = font.write({ type: 'ttf', toBuffer: true });
  await woff2.init();
  const woff = font.write({ type: 'woff2', toBuffer: true });
  for (const [name, mediaType, bytes] of [
    ['body.ttf', 'font/ttf', ttf],
    ['body.woff2', 'font/woff2', woff]
  ] as const) {
    const result = await optimizeAssetManifest([
      asAsset(`src/assets/${name}`, mediaType, bytes, { role: 'font' })
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0]?.provenance?.source, 'supplied');
    assert.match(result.assets[0]?.provenance?.transformer ?? '', /trusted-asset-codec/);
  }
});

test('rejects OTF instead of silently leaving it unoptimized', async () => {
  const fakeOtf = Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(32)]);
  await assert.rejects(
    () =>
      optimizeAssetManifest([
        asAsset('src/assets/display.otf', 'font/otf', fakeOtf, { role: 'font' })
      ]),
    /cannot be reproducibly rewritten/
  );
});
