import {
  ART_DIRECTION_BENCHMARK_DIMENSIONS,
  evaluateArtDirectionBenchmark,
  type ArtDirectionBenchmarkEvidence,
  type ArtDirectionBenchmarkDimension
} from './art-direction.ts';

export const PHASE3_BENCHMARK_DIMENSIONS = [
  ...ART_DIRECTION_BENCHMARK_DIMENSIONS,
  'generated_project_validity',
  'successful_deterministic_build',
  'page_map_coverage',
  'selected_direction_fidelity',
  'typography_hierarchy',
  'composition_differentiation',
  'responsive_intent',
  'accessibility_essentials',
  'reduced_motion_behavior',
  'prohibited_pattern_resistance',
  'preview_isolation',
  'last_known_good_behavior'
] as const;

export type Phase3BenchmarkDimension = (typeof PHASE3_BENCHMARK_DIMENSIONS)[number];
export type Phase3EvidenceKind = 'machine' | 'human';

export interface Phase3RouteRepresentation {
  readonly route: string;
  readonly landmarkCount: number;
  readonly h1Count: number;
  readonly headingLevels: readonly number[];
  readonly typographyScaleSteps: number;
  readonly layoutSignature: string;
  readonly horizontalOverflow: boolean;
  readonly readingOrderStable: boolean;
  readonly visibleFocus: boolean;
  readonly reducedMotionStable: boolean;
  readonly prohibitedPatterns: readonly string[];
  readonly externalNetworkRequests: readonly string[];
  readonly privilegedRuntimeRequests: readonly string[];
}

export interface Phase3RenderedRepresentation {
  readonly id: 'desktop' | 'mobile';
  readonly viewport: { readonly width: number; readonly height: number };
  readonly screenshotSha256: string;
  readonly routes: readonly Phase3RouteRepresentation[];
}

export interface Phase3BenchmarkEvidence {
  readonly workflow: ArtDirectionBenchmarkEvidence;
  readonly generatedProject: {
    readonly contractVersion: string;
    readonly requestDigest: string;
    readonly manifestDigest: string;
    readonly deterministicProvider: boolean;
    readonly validationErrors: readonly string[];
  };
  readonly build: {
    readonly status: 'ready' | 'failed';
    readonly lockedInstall: boolean;
    readonly deterministic: boolean;
    readonly artifactDigest: string;
  };
  readonly pageMap: {
    readonly expectedRoutes: readonly string[];
    readonly builtRoutes: readonly string[];
  };
  readonly rendered: readonly Phase3RenderedRepresentation[];
  readonly directionReview: {
    readonly status: 'pass' | 'fail';
    readonly reviewer: string;
    readonly rationale: string;
  };
  readonly compositionReview: {
    readonly status: 'pass' | 'fail';
    readonly reviewer: string;
    readonly rationale: string;
  };
  readonly preview: {
    readonly status: 'ready' | 'unavailable';
    readonly loopbackOnly: boolean;
    readonly separateOrigin: boolean;
    readonly cspConnectNone: boolean;
    readonly privilegedEndpointStatus: number;
  };
  readonly lastKnownGood: {
    readonly priorBuildId: string;
    readonly failedRebuildId: string;
    readonly failedRebuildStatus: 'failed' | 'ready';
    readonly activeBuildId: string;
    readonly activeArtifactDigest: string;
  };
}

export interface Phase3DimensionResult {
  readonly dimension: Phase3BenchmarkDimension;
  readonly status: 'pass' | 'fail';
  readonly evidenceKind: Phase3EvidenceKind;
  readonly rationale: string;
  readonly details: readonly string[];
}

export interface Phase3BenchmarkReport {
  readonly format: 'universal.design-benchmark.phase3';
  readonly formatVersion: '1';
  readonly passed: boolean;
  readonly dimensions: readonly Phase3DimensionResult[];
}

const SHA256 = /^[a-f0-9]{64}$/;
const routeKey = (route: string): string => route.replace(/\/+$/, '') || '/';

function dimension(
  id: Phase3BenchmarkDimension,
  evidenceKind: Phase3EvidenceKind,
  details: readonly string[],
  success: string,
  failure: string
): Phase3DimensionResult {
  return {
    dimension: id,
    status: details.length === 0 ? 'pass' : 'fail',
    evidenceKind,
    rationale: details.length === 0 ? success : failure,
    details
  };
}

/**
 * Canonicalizes evidence emitted by a trusted browser/render harness. Screenshot
 * digests prove which desktop/mobile representations were reviewed; observations
 * remain explicit facts rather than conclusions inferred from DOM strings.
 */
export function collectPhase3RenderedEvidence(
  representations: readonly Phase3RenderedRepresentation[]
): readonly Phase3RenderedRepresentation[] {
  const ids = new Set<string>();
  return [...representations]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((representation) => {
      if (ids.has(representation.id))
        throw new Error(`Duplicate rendered representation: ${representation.id}.`);
      ids.add(representation.id);
      if (!SHA256.test(representation.screenshotSha256))
        throw new Error(
          `Rendered representation ${representation.id} requires a lowercase SHA-256 digest.`
        );
      if (
        !Number.isInteger(representation.viewport.width) ||
        !Number.isInteger(representation.viewport.height) ||
        representation.viewport.width < 320 ||
        representation.viewport.height < 480
      )
        throw new Error(`Rendered representation ${representation.id} has an invalid viewport.`);
      const routes = new Set<string>();
      return {
        ...representation,
        viewport: { ...representation.viewport },
        routes: [...representation.routes]
          .sort((left, right) => routeKey(left.route).localeCompare(routeKey(right.route)))
          .map((route) => {
            const key = routeKey(route.route);
            if (!key.startsWith('/'))
              throw new Error(`Rendered route must be root-relative: ${route.route}.`);
            if (routes.has(key))
              throw new Error(`Duplicate rendered route in ${representation.id}: ${key}.`);
            routes.add(key);
            return {
              ...route,
              route: key,
              headingLevels: [...route.headingLevels],
              prohibitedPatterns: [...route.prohibitedPatterns].sort(),
              externalNetworkRequests: [...route.externalNetworkRequests].sort(),
              privilegedRuntimeRequests: [...route.privilegedRuntimeRequests].sort()
            };
          })
      };
    });
}

export function evaluatePhase3Benchmark(evidence: Phase3BenchmarkEvidence): Phase3BenchmarkReport {
  const workflow = evaluateArtDirectionBenchmark(evidence.workflow);
  const dimensions: Phase3DimensionResult[] = workflow.dimensions.map((item) => ({
    dimension: item.dimension as ArtDirectionBenchmarkDimension,
    status: item.status,
    evidenceKind:
      item.dimension === 'brief_fit' || item.dimension === 'generic_pattern_resistance'
        ? 'human'
        : 'machine',
    rationale: item.rationale,
    details: item.details
  }));
  const rendered = collectPhase3RenderedEvidence(evidence.rendered);
  const desktop = rendered.find((item) => item.id === 'desktop');
  const mobile = rendered.find((item) => item.id === 'mobile');
  const allRoutes = rendered.flatMap((item) => item.routes);
  const expectedRoutes = new Set(evidence.pageMap.expectedRoutes.map(routeKey));

  const projectDetails: string[] = [];
  if (evidence.generatedProject.contractVersion !== '1.0.0')
    projectDetails.push('Generation contract version is unsupported.');
  if (!SHA256.test(evidence.generatedProject.requestDigest))
    projectDetails.push('Generation request digest is invalid.');
  if (!SHA256.test(evidence.generatedProject.manifestDigest))
    projectDetails.push('Generated manifest digest is invalid.');
  if (!evidence.generatedProject.deterministicProvider)
    projectDetails.push('Golden generation did not use the deterministic provider.');
  projectDetails.push(
    ...evidence.generatedProject.validationErrors.map(
      (error) => `Generated-project validation: ${error}`
    )
  );
  dimensions.push(
    dimension(
      'generated_project_validity',
      'machine',
      projectDetails,
      'The generated project satisfies the versioned contract and manifest policy.',
      'The generated project contract or manifest is invalid.'
    )
  );

  const buildDetails: string[] = [];
  if (evidence.build.status !== 'ready') buildDetails.push('Build did not reach ready.');
  if (!evidence.build.lockedInstall)
    buildDetails.push('Dependency installation was not lockfile-enforced.');
  if (!evidence.build.deterministic) buildDetails.push('Build was not recorded as deterministic.');
  if (!SHA256.test(evidence.build.artifactDigest))
    buildDetails.push('Build artifact digest is invalid.');
  dimensions.push(
    dimension(
      'successful_deterministic_build',
      'machine',
      buildDetails,
      'A locked deterministic build produced a digest-addressed artifact.',
      'The deterministic build gate failed.'
    )
  );

  const pageDetails = [...expectedRoutes]
    .filter((route) => !evidence.pageMap.builtRoutes.map(routeKey).includes(route))
    .map((route) => `Built output is missing ${route}.`);
  for (const representation of rendered)
    for (const route of expectedRoutes)
      if (!representation.routes.some((item) => routeKey(item.route) === route))
        pageDetails.push(`${representation.id} representation is missing ${route}.`);
  dimensions.push(
    dimension(
      'page_map_coverage',
      'machine',
      pageDetails,
      'Every approved route is built and represented at desktop and mobile viewports.',
      'The rendered project does not cover the approved page map.'
    )
  );

  const directionDetails =
    evidence.directionReview.status === 'pass' &&
    evidence.directionReview.reviewer.trim() &&
    evidence.directionReview.rationale.trim()
      ? []
      : ['An identified human reviewer did not approve selected-direction fidelity.'];
  dimensions.push(
    dimension(
      'selected_direction_fidelity',
      'human',
      directionDetails,
      'An identified reviewer found the rendered project faithful to the selected direction.',
      'Selected-direction fidelity requires a passing human review.'
    )
  );

  const typographyDetails: string[] = [];
  if (!desktop || !mobile)
    typographyDetails.push('Desktop and mobile rendered representations are required.');
  for (const route of allRoutes) {
    if (route.h1Count !== 1)
      typographyDetails.push(`${route.route} must expose exactly one primary heading.`);
    if (route.typographyScaleSteps < 2)
      typographyDetails.push(`${route.route} lacks a measurable typographic hierarchy.`);
    if (
      route.headingLevels.some(
        (level, index, levels) => index > 0 && level - levels[index - 1]! > 1
      )
    )
      typographyDetails.push(`${route.route} skips a heading level.`);
  }
  dimensions.push(
    dimension(
      'typography_hierarchy',
      'machine',
      typographyDetails,
      'Rendered viewports preserve one primary heading, ordered levels, and multiple type-scale steps.',
      'Rendered typography hierarchy is structurally weak.'
    )
  );

  const compositionDetails: string[] = [];
  for (const representation of rendered)
    if (
      new Set(representation.routes.map((route) => route.layoutSignature)).size <
      Math.min(2, expectedRoutes.size)
    )
      compositionDetails.push(`${representation.id} pages collapse to one layout signature.`);
  if (
    evidence.compositionReview.status !== 'pass' ||
    !evidence.compositionReview.reviewer.trim() ||
    !evidence.compositionReview.rationale.trim()
  )
    compositionDetails.push(
      'An identified human reviewer did not approve composition differentiation.'
    );
  dimensions.push(
    dimension(
      'composition_differentiation',
      'human',
      compositionDetails,
      'Distinct route compositions are measured and confirmed by an identified reviewer.',
      'Composition differentiation is unproven or regressed.'
    )
  );

  const responsiveDetails: string[] = [];
  if (!desktop || desktop.viewport.width < 1024)
    responsiveDetails.push('A desktop representation of at least 1024px is required.');
  if (!mobile || mobile.viewport.width > 480)
    responsiveDetails.push('A mobile representation of at most 480px is required.');
  for (const route of allRoutes) {
    if (route.horizontalOverflow) responsiveDetails.push(`${route.route} has horizontal overflow.`);
    if (!route.readingOrderStable)
      responsiveDetails.push(`${route.route} changes logical reading order.`);
  }
  dimensions.push(
    dimension(
      'responsive_intent',
      'machine',
      responsiveDetails,
      'Desktop and mobile evidence preserve fit and logical reading order.',
      'Responsive behavior violates the approved intent.'
    )
  );

  const accessibilityDetails = allRoutes.flatMap((route) => [
    ...(route.landmarkCount < 2 ? [`${route.route} lacks semantic landmarks.`] : []),
    ...(route.h1Count !== 1 ? [`${route.route} lacks one primary heading.`] : []),
    ...(!route.visibleFocus ? [`${route.route} lacks a visible focus indicator.`] : [])
  ]);
  dimensions.push(
    dimension(
      'accessibility_essentials',
      'machine',
      accessibilityDetails,
      'Rendered routes expose landmarks, one h1, and visible focus.',
      'Accessibility essentials are missing.'
    )
  );

  const motionDetails = allRoutes
    .filter((route) => !route.reducedMotionStable)
    .map((route) => `${route.route} changes or animates under reduced motion.`);
  dimensions.push(
    dimension(
      'reduced_motion_behavior',
      'machine',
      motionDetails,
      'All rendered routes remain stable under reduced-motion preference.',
      'Reduced-motion behavior regressed.'
    )
  );

  const patternDetails = allRoutes.flatMap((route) =>
    route.prohibitedPatterns.map((pattern) => `${route.route}: ${pattern}`)
  );
  dimensions.push(
    dimension(
      'prohibited_pattern_resistance',
      'machine',
      patternDetails,
      'Rendered pages contain no policy-prohibited patterns.',
      'Rendered pages contain prohibited patterns.'
    )
  );

  const isolationDetails: string[] = [];
  if (evidence.preview.status !== 'ready') isolationDetails.push('Preview is not ready.');
  if (!evidence.preview.loopbackOnly) isolationDetails.push('Preview is not loopback-only.');
  if (!evidence.preview.separateOrigin)
    isolationDetails.push('Preview is not on a separate origin.');
  if (!evidence.preview.cspConnectNone)
    isolationDetails.push('Preview CSP does not deny connections.');
  if (evidence.preview.privilegedEndpointStatus !== 404)
    isolationDetails.push('Preview origin exposes a privileged runtime endpoint.');
  for (const route of allRoutes) {
    isolationDetails.push(
      ...route.externalNetworkRequests.map(
        (request) => `${route.route} made external request ${request}.`
      )
    );
    isolationDetails.push(
      ...route.privilegedRuntimeRequests.map(
        (request) => `${route.route} attempted privileged request ${request}.`
      )
    );
  }
  dimensions.push(
    dimension(
      'preview_isolation',
      'machine',
      isolationDetails,
      'The ready preview is loopback-only, cross-origin, network-denied, and exposes no runtime API.',
      'Preview isolation controls failed.'
    )
  );

  const lastGoodDetails: string[] = [];
  if (evidence.lastKnownGood.failedRebuildStatus !== 'failed')
    lastGoodDetails.push('The negative rebuild did not fail as intended.');
  if (evidence.lastKnownGood.activeBuildId !== evidence.lastKnownGood.priorBuildId)
    lastGoodDetails.push('The failed rebuild displaced the prior ready build.');
  if (evidence.lastKnownGood.activeArtifactDigest !== evidence.build.artifactDigest)
    lastGoodDetails.push('The active preview artifact changed after the failed rebuild.');
  if (evidence.lastKnownGood.failedRebuildId === evidence.lastKnownGood.priorBuildId)
    lastGoodDetails.push('The failed rebuild does not have a distinct identity.');
  dimensions.push(
    dimension(
      'last_known_good_behavior',
      'machine',
      lastGoodDetails,
      'A failed newer rebuild leaves the prior digest-addressed preview active.',
      'Last-known-good behavior failed.'
    )
  );

  return {
    format: 'universal.design-benchmark.phase3',
    formatVersion: '1',
    passed:
      dimensions.length === PHASE3_BENCHMARK_DIMENSIONS.length &&
      dimensions.every((item) => item.status === 'pass'),
    dimensions
  };
}
