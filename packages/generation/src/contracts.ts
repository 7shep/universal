import type {
  ColorSystem,
  CompositionSignatureV2,
  DesignPlanV2,
  MotionStrategy,
  NavigationSignature,
  PageMap,
  PageNarrative,
  ResponsiveTransformation,
  TypographySystem
} from '@universal/design-engine';

export const GENERATION_CONTRACT_VERSION = '1.0.0' as const;
export const GENERATED_PROJECT_CONTRACT_VERSION = '1.0.0' as const;

export interface ArtifactBinding {
  id: string;
  digest: string;
}
export interface ApprovedBriefBinding extends ArtifactBinding {
  version: number;
  approvalDigest: string;
}
export interface DesignPlanBinding extends ArtifactBinding {
  contractVersion: string;
}

export interface GenerationContext {
  pageMap: PageMap;
  pageNarratives: readonly PageNarrative[];
  typography: TypographySystem;
  colors: ColorSystem;
  composition: CompositionSignatureV2;
  navigation: NavigationSignature;
  responsiveTransformations: readonly ResponsiveTransformation[];
  motion: MotionStrategy;
  prohibitedPatterns: readonly string[];
  decisionProvenanceIds: readonly string[];
  protectedInvariants: readonly string[];
  implementationConstraints: readonly string[];
}

export interface ProjectGenerationRequest {
  contractVersion: typeof GENERATION_CONTRACT_VERSION;
  projectId: string;
  revisionId: string;
  brief: ApprovedBriefBinding;
  direction: ArtifactBinding;
  plan: DesignPlanBinding;
  designPlan: DesignPlanV2;
  context: GenerationContext;
}

export type ProjectFileKind = 'react' | 'typescript' | 'stylesheet' | 'text';
export interface ProjectFile {
  path: string;
  content: string;
  kind: ProjectFileKind;
  digest: string;
}
export interface GeneratedAsset {
  path: string;
  mediaType: string;
  encoding: 'base64';
  content: string;
  digest: string;
}
export type GenerationDiagnosticSeverity = 'info' | 'warning' | 'error';
export interface GenerationDiagnostic {
  code: string;
  severity: GenerationDiagnosticSeverity;
  message: string;
  path?: string | undefined;
}
export interface GeneratedProject {
  contractVersion: typeof GENERATED_PROJECT_CONTRACT_VERSION;
  projectId: string;
  revisionId: string;
  requestDigest: string;
  framework: 'react-vite';
  entrypoint: 'src/main.tsx';
  files: readonly ProjectFile[];
  assets: readonly GeneratedAsset[];
  diagnostics: readonly GenerationDiagnostic[];
}

export interface ProviderCapabilities {
  providerId: string;
  contractVersions: readonly [typeof GENERATION_CONTRACT_VERSION];
  structuredOutput: true;
  deterministic: boolean;
  requiresCredentials: boolean;
}
export type ProviderFailureCode =
  | 'authentication'
  | 'rate-limit'
  | 'timeout'
  | 'cancelled'
  | 'malformed-output'
  | 'unavailable'
  | 'internal';
export interface ProviderFailure {
  code: ProviderFailureCode;
  providerId: string;
  message: string;
  retryable: boolean;
  diagnostics: readonly GenerationDiagnostic[];
}
export type GenerationResult =
  { ok: true; project: GeneratedProject } | { ok: false; failure: ProviderFailure };
export interface ReactGenerationProvider {
  readonly capabilities: ProviderCapabilities;
  generate(request: ProjectGenerationRequest, signal?: AbortSignal): Promise<unknown>;
}
export interface RawGeneratedProject {
  files: readonly { path: string; content: string; kind: ProjectFileKind }[];
  assets?:
    readonly { path: string; mediaType: string; encoding: 'base64'; content: string }[] | undefined;
}
export interface GenerationValidationError {
  code:
    | 'invalid_request'
    | 'stale_artifact'
    | 'provider_schema_violation'
    | 'forbidden_file'
    | 'quota_exceeded';
  path: string;
  message: string;
}
