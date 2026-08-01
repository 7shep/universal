import { createHash } from 'node:crypto';
import path from 'node:path';
import { createFont, woff2 } from 'fonteditor-core';
import sharp, { type Sharp } from 'sharp';
import { validateAssetManifest, type GeneratedAsset } from '@universal/generation';
import { RuntimeFailure } from './errors.ts';

export const TRUSTED_ASSET_CODEC_VERSION = '1.0.0' as const;
export const RESPONSIVE_IMAGE_WIDTHS = [640, 1280] as const;

let woff2Ready: Promise<unknown> | undefined;

function digestContent(content: string): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function generatedPath(assetPath: string, width: number): string {
  const extension = path.posix.extname(assetPath);
  return `${assetPath.slice(0, -extension.length)}-w${width}${extension}`;
}

function optimizedAsset(
  asset: GeneratedAsset,
  bytes: Uint8Array,
  dimensions?: { width: number; height: number },
  outputPath = asset.path
): GeneratedAsset {
  const content = Buffer.from(bytes).toString('base64');
  return {
    ...asset,
    path: outputPath,
    content,
    digest: digestContent(content),
    ...(dimensions ? { dimensions } : {}),
    provenance: {
      source: asset.provenance?.source ?? 'supplied',
      ...(asset.provenance?.generator ? { generator: asset.provenance.generator } : {}),
      sourceDigest: asset.provenance?.sourceDigest ?? asset.digest,
      transformer: `universal-trusted-asset-codec@${TRUSTED_ASSET_CODEC_VERSION}`
    }
  };
}

async function optimizeRaster(asset: GeneratedAsset): Promise<GeneratedAsset[]> {
  const source = Buffer.from(asset.content, 'base64');
  const image = sharp(source, { failOn: 'error', limitInputPixels: 32_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height)
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      `Raster dimensions could not be determined: ${asset.path}`,
      { path: asset.path }
    );

  async function encode(instance: Sharp): Promise<Uint8Array> {
    if (asset.mediaType === 'image/png')
      return instance
        .png({
          compressionLevel: 9,
          adaptiveFiltering: false,
          palette: false,
          effort: 10
        })
        .toBuffer();
    if (asset.mediaType === 'image/jpeg')
      return instance
        .jpeg({
          quality: 90,
          chromaSubsampling: '4:4:4',
          progressive: false,
          optimizeCoding: true,
          mozjpeg: false
        })
        .toBuffer();
    return instance.webp({ lossless: true, effort: 6 }).toBuffer();
  }

  const outputs = [
    optimizedAsset(
      asset,
      await encode(sharp(source, { failOn: 'error', limitInputPixels: 32_000_000 })),
      { width: metadata.width, height: metadata.height }
    )
  ];
  if (!asset.responsiveGroup) return outputs;
  for (const width of RESPONSIVE_IMAGE_WIDTHS) {
    if (width >= metadata.width) continue;
    const height = Math.max(1, Math.round((metadata.height * width) / metadata.width));
    const resized = sharp(source, { failOn: 'error', limitInputPixels: 32_000_000 }).resize({
      width,
      height,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    });
    outputs.push(
      optimizedAsset(
        asset,
        await encode(resized),
        { width, height },
        generatedPath(asset.path, width)
      )
    );
  }
  return outputs;
}

async function optimizeFont(asset: GeneratedAsset): Promise<GeneratedAsset> {
  if (asset.mediaType === 'font/otf')
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'OpenType/CFF assets are validated but cannot be reproducibly rewritten by the trusted codec; supply WOFF2, WOFF, or TrueType instead.',
      { path: asset.path }
    );
  const type =
    asset.mediaType === 'font/woff2' ? 'woff2' : asset.mediaType === 'font/woff' ? 'woff' : 'ttf';
  if (type === 'woff2') {
    woff2Ready ??= woff2.init();
    await woff2Ready;
  }
  try {
    const font = createFont(Buffer.from(asset.content, 'base64'), {
      type,
      hinting: true,
      compound2simple: false
    });
    font.optimize();
    font.sort();
    const output = font.write({
      type,
      hinting: true,
      toBuffer: true
    });
    return optimizedAsset(asset, new Uint8Array(output));
  } catch (error) {
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      `Font optimization failed for ${asset.path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { path: asset.path }
    );
  }
}

export async function optimizeAssetManifest(
  assets: readonly GeneratedAsset[]
): Promise<ReturnType<typeof validateAssetManifest> & { codecVersion?: string }> {
  const input = validateAssetManifest(assets);
  if (!input.ok) return input;
  const outputs: GeneratedAsset[] = [];
  for (const asset of input.assets) {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(asset.mediaType))
      outputs.push(...(await optimizeRaster(asset)));
    else if (asset.mediaType.startsWith('font/')) outputs.push(await optimizeFont(asset));
    else outputs.push(asset);
  }
  const checked = validateAssetManifest(outputs);
  return checked.ok ? { ...checked, codecVersion: TRUSTED_ASSET_CODEC_VERSION } : checked;
}
