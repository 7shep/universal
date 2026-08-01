import type { GeneratedAsset } from './contracts.ts';
import { digestValue } from './digest.ts';

export const ASSET_POLICY_VERSION = '1.0.0' as const;
export const ASSET_LIMITS = {
  maxFiles: 32,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 12 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 32_000_000
} as const;

export interface AssetPolicyFinding {
  code: string;
  path: string;
  message: string;
}

export type AssetValidationResult =
  | {
      ok: true;
      assets: readonly GeneratedAsset[];
      manifest: {
        version: typeof ASSET_POLICY_VERSION;
        totalBytes: number;
        entries: readonly Omit<GeneratedAsset, 'content'>[];
      };
    }
  | { ok: false; findings: readonly AssetPolicyFinding[] };

const mediaExtensions: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'font/woff2': ['.woff2'],
  'font/woff': ['.woff'],
  'font/ttf': ['.ttf'],
  'font/otf': ['.otf']
};
const safePath = /^src\/assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
const svgActiveContent =
  /<\s*(?:script|foreignObject|iframe|object|embed|audio|video)\b|(?:^|\s)on[a-z]+\s*=|<!DOCTYPE|<!ENTITY|(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)|url\(\s*["']?(?:https?:|\/\/|data:|javascript:)/i;

function extension(value: string): string {
  const index = value.lastIndexOf('.');
  return index < 0 ? '' : value.slice(index).toLowerCase();
}

function strictBase64(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(value))
    return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value ? bytes : null;
}

function detectedMediaType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    Buffer.from(bytes.subarray(1, 4)).toString('ascii') === 'PNG'
  )
    return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 512)))
    .toString('utf8')
    .trimStart();
  if (head.startsWith('<svg') || /^<\?xml[\s\S]*?<svg\b/.test(head)) return 'image/svg+xml';
  if (bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'wOF2')
    return 'font/woff2';
  if (bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'wOFF')
    return 'font/woff';
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
      Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'true')
  )
    return 'font/ttf';
  if (bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'OTTO')
    return 'font/otf';
  return null;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24) return undefined;
  const buffer = Buffer.from(bytes);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function validateMetadata(
  asset: GeneratedAsset,
  index: number,
  findings: AssetPolicyFinding[]
): void {
  if (asset.role !== undefined && !['image', 'font', 'illustration', 'icon'].includes(asset.role))
    findings.push({
      code: 'ASSET_ROLE_INVALID',
      path: `assets.${index}.role`,
      message: 'Asset role is not supported.'
    });
  if (asset.provenance) {
    if (
      typeof asset.provenance.source !== 'string' ||
      !['generated', 'supplied'].includes(asset.provenance.source)
    )
      findings.push({
        code: 'ASSET_PROVENANCE_INVALID',
        path: `assets.${index}.provenance.source`,
        message: 'Asset provenance source must be generated or supplied.'
      });
    if (
      asset.provenance.source === 'generated' &&
      (typeof asset.provenance.generator !== 'string' || !asset.provenance.generator.trim())
    )
      findings.push({
        code: 'ASSET_PROVENANCE_INVALID',
        path: `assets.${index}.provenance.generator`,
        message: 'Generated assets must identify their generator.'
      });
    if (
      asset.provenance.transformer !== undefined &&
      (typeof asset.provenance.transformer !== 'string' ||
        !/^universal-trusted-asset-codec@[0-9]+\.[0-9]+\.[0-9]+$/.test(
          asset.provenance.transformer
        ))
    )
      findings.push({
        code: 'ASSET_PROVENANCE_INVALID',
        path: `assets.${index}.provenance.transformer`,
        message: 'Asset transformers must identify a versioned trusted runtime codec.'
      });
  }
  if (
    asset.license &&
    (typeof asset.license.identifier !== 'string' || !asset.license.identifier.trim())
  )
    findings.push({
      code: 'ASSET_LICENSE_INVALID',
      path: `assets.${index}.license.identifier`,
      message: 'Asset license identifiers cannot be empty.'
    });
  if (
    asset.license?.sourceUrl &&
    (typeof asset.license.sourceUrl !== 'string' ||
      !/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(asset.license.sourceUrl))
  )
    findings.push({
      code: 'ASSET_LICENSE_INVALID',
      path: `assets.${index}.license.sourceUrl`,
      message: 'Attribution source URLs must use HTTPS.'
    });
  if (
    asset.responsiveGroup !== undefined &&
    (typeof asset.responsiveGroup !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(asset.responsiveGroup))
  )
    findings.push({
      code: 'ASSET_RESPONSIVE_GROUP_INVALID',
      path: `assets.${index}.responsiveGroup`,
      message: 'Responsive image group identifiers must be lowercase portable identifiers.'
    });
}

export function optimizeAssetDeterministically(mediaType: string, bytes: Uint8Array): Uint8Array {
  if (mediaType !== 'image/svg+xml') return bytes;
  const normalized = Buffer.from(bytes)
    .toString('utf8')
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  return Buffer.from(`${normalized}\n`, 'utf8');
}

export function validateAssetManifest(assets: readonly GeneratedAsset[]): AssetValidationResult {
  const findings: AssetPolicyFinding[] = [];
  if (assets.length > ASSET_LIMITS.maxFiles)
    findings.push({
      code: 'ASSET_FILE_COUNT_EXCEEDED',
      path: 'assets',
      message: `Asset manifest may contain at most ${ASSET_LIMITS.maxFiles} files.`
    });
  const folded = new Set<string>();
  let totalBytes = 0;
  const normalized: GeneratedAsset[] = [];
  for (const [index, asset] of assets.entries()) {
    const base = `assets.${index}`;
    if (
      !safePath.test(asset.path) ||
      asset.path.includes('//') ||
      asset.path.split('/').some((part) => part === '.' || part === '..')
    )
      findings.push({
        code: 'ASSET_PATH_INVALID',
        path: `${base}.path`,
        message: 'Asset paths must be canonical relative paths beneath src/assets.'
      });
    const foldedPath = asset.path.toLocaleLowerCase('en-US');
    if (folded.has(foldedPath))
      findings.push({
        code: 'ASSET_PATH_COLLISION',
        path: `${base}.path`,
        message: 'Asset paths collide after case folding.'
      });
    folded.add(foldedPath);
    const allowedExtensions = mediaExtensions[asset.mediaType];
    if (!allowedExtensions || !allowedExtensions.includes(extension(asset.path)))
      findings.push({
        code: 'ASSET_EXTENSION_MISMATCH',
        path: `${base}.path`,
        message: 'Asset extension does not match its declared media type.'
      });
    const bytes = strictBase64(asset.content);
    if (!bytes) {
      findings.push({
        code: 'ASSET_ENCODING_INVALID',
        path: `${base}.content`,
        message: 'Asset content must be canonical base64.'
      });
      continue;
    }
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > ASSET_LIMITS.maxFileBytes)
      findings.push({
        code: 'ASSET_FILE_SIZE_EXCEEDED',
        path: `${base}.content`,
        message: `Asset exceeds the ${ASSET_LIMITS.maxFileBytes}-byte individual limit.`
      });
    const detected = detectedMediaType(bytes);
    if (detected !== asset.mediaType)
      findings.push({
        code: 'ASSET_MEDIA_TYPE_MISMATCH',
        path: `${base}.mediaType`,
        message: `Declared ${asset.mediaType} does not match detected ${detected ?? 'unknown'} content.`
      });
    if (asset.mediaType === 'image/svg+xml') {
      const svg = Buffer.from(bytes).toString('utf8');
      if (svgActiveContent.test(svg))
        findings.push({
          code: 'ASSET_SVG_ACTIVE_CONTENT',
          path: `${base}.content`,
          message: 'SVG contains active content, remote references, or executable attributes.'
        });
    }
    const detectedDimensions =
      asset.mediaType === 'image/png' ? pngDimensions(bytes) : asset.dimensions;
    if (detectedDimensions) {
      if (
        !Number.isSafeInteger(detectedDimensions.width) ||
        !Number.isSafeInteger(detectedDimensions.height) ||
        detectedDimensions.width < 1 ||
        detectedDimensions.height < 1 ||
        detectedDimensions.width > ASSET_LIMITS.maxDimension ||
        detectedDimensions.height > ASSET_LIMITS.maxDimension ||
        detectedDimensions.width * detectedDimensions.height > ASSET_LIMITS.maxPixels
      )
        findings.push({
          code: 'ASSET_DIMENSIONS_EXCEEDED',
          path: `${base}.dimensions`,
          message: 'Image dimensions exceed the configured dimension or pixel limit.'
        });
      if (
        asset.dimensions &&
        (asset.dimensions.width !== detectedDimensions.width ||
          asset.dimensions.height !== detectedDimensions.height)
      )
        findings.push({
          code: 'ASSET_DIMENSIONS_MISMATCH',
          path: `${base}.dimensions`,
          message: 'Declared image dimensions do not match the encoded image.'
        });
    }
    validateMetadata(asset, index, findings);
    const optimized = optimizeAssetDeterministically(asset.mediaType, bytes);
    normalized.push({
      ...asset,
      content: Buffer.from(optimized).toString('base64'),
      digest: digestValue(Buffer.from(optimized).toString('base64')),
      ...(detectedDimensions ? { dimensions: detectedDimensions } : {})
    });
  }
  if (totalBytes > ASSET_LIMITS.maxTotalBytes)
    findings.push({
      code: 'ASSET_TOTAL_SIZE_EXCEEDED',
      path: 'assets',
      message: `Asset manifest exceeds the ${ASSET_LIMITS.maxTotalBytes}-byte total limit.`
    });
  if (findings.length > 0) return { ok: false, findings };
  return {
    ok: true,
    assets: normalized,
    manifest: {
      version: ASSET_POLICY_VERSION,
      totalBytes: normalized.reduce(
        (sum, asset) => sum + Buffer.from(asset.content, 'base64').byteLength,
        0
      ),
      entries: normalized.map(
        (asset) =>
          Object.fromEntries(
            Object.entries(asset).filter(([key]) => key !== 'content')
          ) as unknown as Omit<GeneratedAsset, 'content'>
      )
    }
  };
}
