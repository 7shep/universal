import { validateDesignPlanV2 } from '@universal/design-engine';
import {
  GENERATED_PROJECT_CONTRACT_VERSION,
  GENERATION_CONTRACT_VERSION,
  type ArtifactBinding,
  type ApprovedBriefBinding,
  type DesignPlanBinding,
  type GeneratedAsset,
  type GeneratedProject,
  type GenerationContext,
  type GenerationValidationError,
  type ProjectFile,
  type ProjectFileKind,
  type ProjectGenerationRequest
} from './contracts.ts';
import { digestValue } from './digest.ts';
import { createGenerationContext } from './request.ts';
import { validateAssetManifest } from './assets.ts';

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: GenerationValidationError };
const fail = (
  code: GenerationValidationError['code'],
  path: string,
  message: string
): ValidationResult<never> => ({ ok: false, error: { code, path, message } });
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const digest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9:-]{7,}$/i.test(value);
const equal = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const MAX_FILES = 64;
const MAX_ASSETS = 16;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const allowedSource = /^src\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:tsx?|css|txt)$/;
const runtimeOwned = new Set([
  'src/main.tsx',
  'package.json',
  'pnpm-lock.yaml',
  'vite.config.ts',
  'tsconfig.json',
  'index.html'
]);

function parseBinding(value: unknown, path: string): ValidationResult<ArtifactBinding> {
  if (!record(value)) return fail('invalid_request', path, `${path} must be an object.`);
  if (!text(value.id)) return fail('invalid_request', `${path}.id`, `${path}.id is required.`);
  if (!digest(value.digest))
    return fail(
      'invalid_request',
      `${path}.digest`,
      `${path}.digest must be a versioned content digest.`
    );
  return { ok: true, value: { id: value.id, digest: value.digest } };
}
function parseBrief(value: unknown): ValidationResult<ApprovedBriefBinding> {
  const base = parseBinding(value, 'brief');
  if (!base.ok) return { ok: false, error: base.error };
  if (!record(value)) return fail('invalid_request', 'brief', 'brief must be an object.');
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1)
    return fail('invalid_request', 'brief.version', 'brief.version must be a positive integer.');
  if (!digest(value.approvalDigest))
    return fail(
      'invalid_request',
      'brief.approvalDigest',
      'brief.approvalDigest must be a versioned content digest.'
    );
  return {
    ok: true,
    value: { ...base.value, version: Number(value.version), approvalDigest: value.approvalDigest }
  };
}
function parsePlanBinding(value: unknown): ValidationResult<DesignPlanBinding> {
  const base = parseBinding(value, 'plan');
  if (!base.ok) return { ok: false, error: base.error };
  if (!record(value) || !text(value.contractVersion))
    return fail('invalid_request', 'plan.contractVersion', 'plan.contractVersion is required.');
  return { ok: true, value: { ...base.value, contractVersion: value.contractVersion } };
}

export function validateProjectGenerationRequest(
  value: unknown
): ValidationResult<ProjectGenerationRequest> {
  if (!record(value)) return fail('invalid_request', '$', 'Generation request must be an object.');
  if (value.contractVersion !== GENERATION_CONTRACT_VERSION)
    return fail(
      'invalid_request',
      'contractVersion',
      `contractVersion must be ${GENERATION_CONTRACT_VERSION}.`
    );
  if (!text(value.projectId)) return fail('invalid_request', 'projectId', 'projectId is required.');
  if (!text(value.revisionId))
    return fail('invalid_request', 'revisionId', 'revisionId is required.');
  const brief = parseBrief(value.brief);
  if (!brief.ok) return { ok: false, error: brief.error };
  const direction = parseBinding(value.direction, 'direction');
  if (!direction.ok) return { ok: false, error: direction.error };
  const planBinding = parsePlanBinding(value.plan);
  if (!planBinding.ok) return { ok: false, error: planBinding.error };
  const checkedPlan = validateDesignPlanV2(value.designPlan);
  if (!checkedPlan.ok)
    return fail(
      'invalid_request',
      `designPlan.${checkedPlan.error.path}`,
      checkedPlan.error.message
    );
  const plan = checkedPlan.value;
  const checks: readonly [boolean, string, string][] = [
    [brief.value.id === plan.source.briefId, 'brief.id', 'Brief id does not match the plan.'],
    [
      brief.value.version === plan.source.briefVersion,
      'brief.version',
      'Brief version does not match the plan.'
    ],
    [
      brief.value.digest === plan.source.briefDigest,
      'brief.digest',
      'Brief digest does not match the plan.'
    ],
    [
      brief.value.approvalDigest === plan.source.approvedDigest,
      'brief.approvalDigest',
      'Approval digest does not match the plan.'
    ],
    [
      brief.value.digest === brief.value.approvalDigest,
      'brief.approvalDigest',
      'Approval is stale for the bound brief.'
    ],
    [
      direction.value.id === plan.source.directionId,
      'direction.id',
      'Direction id does not match the plan.'
    ],
    [
      direction.value.digest === plan.source.evaluationDigest,
      'direction.digest',
      'Direction digest does not match the selected evaluation.'
    ],
    [planBinding.value.id === plan.id, 'plan.id', 'Plan id does not match.'],
    [planBinding.value.digest === plan.digest, 'plan.digest', 'Plan digest does not match.'],
    [
      planBinding.value.contractVersion === plan.contractVersion,
      'plan.contractVersion',
      'Plan contract version does not match.'
    ]
  ];
  for (const [ok, path, message] of checks) if (!ok) return fail('stale_artifact', path, message);
  const expectedContext = createGenerationContext(plan);
  if (!record(value.context))
    return fail('invalid_request', 'context', 'context must be an object.');
  for (const field of Object.keys(expectedContext) as (keyof GenerationContext)[])
    if (!equal(value.context[field], expectedContext[field]))
      return fail(
        'stale_artifact',
        `context.${field}`,
        `context.${field} does not match the Design Plan v2.`
      );
  return {
    ok: true,
    value: {
      contractVersion: GENERATION_CONTRACT_VERSION,
      projectId: value.projectId,
      revisionId: value.revisionId,
      brief: brief.value,
      direction: direction.value,
      plan: planBinding.value,
      designPlan: plan,
      context: expectedContext
    }
  };
}

function parseFile(value: unknown, index: number): ValidationResult<ProjectFile> {
  const base = `files.${index}`;
  if (!record(value))
    return fail('provider_schema_violation', base, 'Project file must be an object.');
  if (!text(value.path))
    return fail('provider_schema_violation', `${base}.path`, 'Project file path is required.');
  if (
    !allowedSource.test(value.path) ||
    value.path.includes('//') ||
    value.path.split('/').includes('..') ||
    runtimeOwned.has(value.path)
  )
    return fail(
      'forbidden_file',
      `${base}.path`,
      `Provider file ${value.path} is outside the source allowlist.`
    );
  if (typeof value.content !== 'string')
    return fail('provider_schema_violation', `${base}.content`, 'File content must be text.');
  const kinds: readonly ProjectFileKind[] = ['react', 'typescript', 'stylesheet', 'text'];
  if (!kinds.some((kind) => kind === value.kind))
    return fail('provider_schema_violation', `${base}.kind`, 'Project file kind is invalid.');
  if (Buffer.byteLength(value.content) > MAX_FILE_BYTES)
    return fail('quota_exceeded', `${base}.content`, 'Project file exceeds its quota.');
  const kind = kinds.find((candidate) => candidate === value.kind)!;
  return {
    ok: true,
    value: { path: value.path, content: value.content, kind, digest: digestValue(value.content) }
  };
}
function parseAsset(value: unknown, index: number): ValidationResult<GeneratedAsset> {
  const base = `assets.${index}`;
  if (!record(value))
    return fail('provider_schema_violation', base, 'Generated asset must be an object.');
  if (
    !text(value.path) ||
    !/^src\/assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value.path) ||
    value.path.split('/').includes('..')
  )
    return fail('forbidden_file', `${base}.path`, 'Generated asset path is invalid.');
  if (
    !text(value.mediaType) ||
    !/^(?:image\/(?:png|jpeg|webp|svg\+xml)|font\/(?:woff2?|ttf|otf))$/.test(value.mediaType)
  )
    return fail(
      'provider_schema_violation',
      `${base}.mediaType`,
      'Generated asset media type is invalid.'
    );
  if (value.encoding !== 'base64' || typeof value.content !== 'string')
    return fail('provider_schema_violation', `${base}.content`, 'Generated assets must be base64.');
  const bytes = Buffer.from(value.content, 'base64');
  if (bytes.byteLength > MAX_FILE_BYTES)
    return fail('quota_exceeded', `${base}.content`, 'Generated asset exceeds its quota.');
  return {
    ok: true,
    value: {
      path: value.path,
      mediaType: value.mediaType,
      encoding: 'base64',
      content: value.content,
      digest: digestValue(value.content),
      ...(text(value.role) ? { role: value.role as GeneratedAsset['role'] } : {}),
      ...(record(value.provenance)
        ? { provenance: value.provenance as unknown as NonNullable<GeneratedAsset['provenance']> }
        : {}),
      ...(record(value.license)
        ? { license: value.license as unknown as NonNullable<GeneratedAsset['license']> }
        : {}),
      ...(record(value.dimensions)
        ? {
            dimensions: {
              width: Number(value.dimensions.width),
              height: Number(value.dimensions.height)
            }
          }
        : {}),
      ...(text(value.responsiveGroup) ? { responsiveGroup: value.responsiveGroup } : {})
    }
  };
}
export function validateProviderProject(
  value: unknown,
  request: ProjectGenerationRequest
): ValidationResult<GeneratedProject> {
  if (!record(value) || !Array.isArray(value.files))
    return fail('provider_schema_violation', '$', 'Provider output must contain files.');
  if (value.files.length < 1 || value.files.length > MAX_FILES)
    return fail('quota_exceeded', 'files', `Provider must emit 1-${MAX_FILES} files.`);
  const files: ProjectFile[] = [];
  for (let index = 0; index < value.files.length; index += 1) {
    const parsed = parseFile(value.files[index], index);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    files.push(parsed.value);
  }
  const folded = files.map((file) => file.path.toLocaleLowerCase('en-US'));
  if (new Set(folded).size !== folded.length)
    return fail('forbidden_file', 'files', 'Provider paths collide after case folding.');
  for (const required of ['src/App.tsx', 'src/styles.css'])
    if (!files.some((file) => file.path === required))
      return fail(
        'provider_schema_violation',
        'files',
        `Provider output must include ${required}.`
      );
  const rawAssets = value.assets === undefined ? [] : value.assets;
  if (!Array.isArray(rawAssets))
    return fail('provider_schema_violation', 'assets', 'assets must be an array.');
  if (rawAssets.length > MAX_ASSETS)
    return fail('quota_exceeded', 'assets', `Provider may emit at most ${MAX_ASSETS} assets.`);
  const assets: GeneratedAsset[] = [];
  for (let index = 0; index < rawAssets.length; index += 1) {
    const parsed = parseAsset(rawAssets[index], index);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    assets.push(parsed.value);
  }
  const checkedAssets = validateAssetManifest(assets);
  if (!checkedAssets.ok) {
    const first = checkedAssets.findings[0]!;
    return fail(
      first.code.includes('SIZE') || first.code.includes('COUNT')
        ? 'quota_exceeded'
        : 'forbidden_file',
      first.path,
      first.message
    );
  }
  const total =
    files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0) +
    assets.reduce((sum, asset) => sum + Buffer.from(asset.content, 'base64').byteLength, 0);
  if (total > MAX_TOTAL_BYTES)
    return fail('quota_exceeded', '$', 'Generated project exceeds its total quota.');
  return {
    ok: true,
    value: {
      contractVersion: GENERATED_PROJECT_CONTRACT_VERSION,
      projectId: request.projectId,
      revisionId: request.revisionId,
      requestDigest: digestValue(request),
      framework: 'react-vite',
      entrypoint: 'src/main.tsx',
      files,
      assets: checkedAssets.assets,
      diagnostics: [
        {
          code: 'GENERATION_VALIDATED',
          severity: 'info',
          message: `Validated ${files.length} source files.`
        }
      ]
    }
  };
}
