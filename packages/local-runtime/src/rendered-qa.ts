import { createHash } from 'node:crypto';
import { RuntimeFailure } from './errors.ts';

export const RENDERED_QA_VERSION = '1.0.0' as const;
export const DEFAULT_QA_VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 }
] as const;

export type RenderedQaSeverity = 'info' | 'warning' | 'error';
export type RenderedQaCategory =
  | 'clipping'
  | 'horizontal-overflow'
  | 'typography'
  | 'responsive-layout'
  | 'empty-region'
  | 'missing-media'
  | 'hierarchy'
  | 'route-regression'
  | 'keyboard-focus'
  | 'reduced-motion'
  | 'capture-failure';

export interface QaViewport {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface RenderedQaFinding {
  id: string;
  kind: 'machine' | 'human';
  category: RenderedQaCategory;
  severity: RenderedQaSeverity;
  route: string;
  viewport: string;
  evidence: Readonly<Record<string, unknown>>;
  message: string;
  suggestedRemediation: string;
}

export interface CaptureObservation {
  screenshot: Uint8Array;
  screenshotPath: string;
  metrics: {
    documentWidth: number;
    viewportWidth: number;
    clippedElements: readonly string[];
    unreadableText: readonly string[];
    emptyRegionRatio: number;
    missingMedia: readonly string[];
    focusVisible: boolean;
    reducedMotionStable: boolean;
    responsiveIssues?: readonly string[];
    hierarchyIssues?: readonly string[];
    blockedNetworkRequests?: readonly string[];
  };
  humanFindings?: readonly Omit<RenderedQaFinding, 'id' | 'route' | 'viewport' | 'kind'>[];
}

export interface RenderedQaCaptureAdapter {
  capture(input: {
    revisionId: string;
    url: string;
    route: string;
    viewport: QaViewport;
    reducedMotion: boolean;
    signal: AbortSignal;
  }): Promise<CaptureObservation>;
}

export interface QaPreviewHandle {
  url: string;
  close(): Promise<void>;
}

export interface RenderedQaLifecycleAdapter {
  build(revisionId: string, signal: AbortSignal): Promise<void>;
  launch(revisionId: string, signal: AbortSignal): Promise<QaPreviewHandle>;
  capture: RenderedQaCaptureAdapter;
  proposeRevision?(
    report: RenderedQaReport,
    signal: AbortSignal
  ): Promise<{
    revisionId: string;
    parentRevisionId: string;
    changedPaths: readonly string[];
  } | null>;
}

export interface RenderedQaReport {
  version: typeof RENDERED_QA_VERSION;
  revisionId: string;
  parentRevisionId?: string | undefined;
  status: 'passed' | 'revision-recommended' | 'failed' | 'timed-out';
  routes: readonly string[];
  viewports: readonly QaViewport[];
  captures: readonly {
    route: string;
    viewport: string;
    screenshotPath: string;
    screenshotDigest: string;
  }[];
  findings: readonly RenderedQaFinding[];
  comparedToRevisionId?: string | undefined;
  regressionCount: number;
}

export interface RenderedQaLifecycleResult {
  initial: RenderedQaReport;
  candidate?: RenderedQaReport | undefined;
  decision:
    'accepted-initial' | 'accepted-candidate' | 'rejected-candidate' | 'revision-unavailable';
}

function routeKey(value: string): string {
  if (!value.startsWith('/') || value.includes('?') || value.includes('#') || value.includes('\\'))
    throw new RuntimeFailure('INVALID_REQUEST', `Invalid approved route: ${value}`, {
      path: 'routes'
    });
  return value.replace(/\/+$/, '') || '/';
}

function loopbackUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname.toLowerCase())
  )
    throw new RuntimeFailure(
      'PREVIEW_UNAVAILABLE',
      'Rendered QA preview must use an HTTP loopback origin.'
    );
  return url;
}

function finding(
  revisionId: string,
  route: string,
  viewport: string,
  category: RenderedQaCategory,
  severity: RenderedQaSeverity,
  evidence: Readonly<Record<string, unknown>>,
  message: string,
  suggestedRemediation: string
): RenderedQaFinding {
  const id = createHash('sha256')
    .update(JSON.stringify({ revisionId, route, viewport, category, evidence }))
    .digest('hex')
    .slice(0, 20);
  return {
    id: `qa:${id}`,
    kind: 'machine',
    category,
    severity,
    route,
    viewport,
    evidence,
    message,
    suggestedRemediation
  };
}

function machineFindings(
  revisionId: string,
  route: string,
  viewport: QaViewport,
  observation: CaptureObservation
): RenderedQaFinding[] {
  const result: RenderedQaFinding[] = [];
  const { metrics } = observation;
  if (metrics.documentWidth > metrics.viewportWidth)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'horizontal-overflow',
        'error',
        { documentWidth: metrics.documentWidth, viewportWidth: metrics.viewportWidth },
        'Rendered document exceeds the viewport width.',
        'Constrain fixed-width content and verify overflow at this viewport.'
      )
    );
  if (metrics.clippedElements.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'clipping',
        'error',
        { selectors: metrics.clippedElements },
        'Rendered content is clipped.',
        'Remove fixed-height clipping or provide an intentional overflow affordance.'
      )
    );
  if (metrics.unreadableText.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'typography',
        'error',
        { selectors: metrics.unreadableText },
        'Text falls below the configured readability threshold.',
        'Increase computed size, line height, or contrast for the affected text.'
      )
    );
  if (metrics.emptyRegionRatio > 0.55)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'empty-region',
        'warning',
        { ratio: metrics.emptyRegionRatio },
        'The viewport contains a large unexplained empty region.',
        'Verify the region is intentional or rebalance the composition.'
      )
    );
  if (metrics.missingMedia.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'missing-media',
        'error',
        { selectors: metrics.missingMedia },
        'Expected media or brand marks did not render.',
        'Restore the local asset reference and confirm its manifest entry.'
      )
    );
  if (!metrics.focusVisible)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'keyboard-focus',
        'error',
        {},
        'Keyboard focus was not visibly distinguishable.',
        'Add a visible :focus-visible treatment with adequate contrast.'
      )
    );
  if (!metrics.reducedMotionStable)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'reduced-motion',
        'error',
        {},
        'Motion remained unstable when reduced motion was requested.',
        'Render a stable final state under prefers-reduced-motion.'
      )
    );
  if (metrics.responsiveIssues?.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'responsive-layout',
        'error',
        { selectors: metrics.responsiveIssues },
        'Rendered controls or content do not fit the responsive viewport.',
        'Replace fixed sizing with a layout that reflows at this viewport.'
      )
    );
  if (metrics.hierarchyIssues?.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'hierarchy',
        'warning',
        { issues: metrics.hierarchyIssues },
        'The rendered heading hierarchy is incomplete or ambiguous.',
        'Restore a single descriptive primary heading and ordered section headings.'
      )
    );
  if (metrics.blockedNetworkRequests?.length)
    result.push(
      finding(
        revisionId,
        route,
        viewport.id,
        'missing-media',
        'error',
        { blockedRequests: metrics.blockedNetworkRequests },
        'Rendered output attempted outbound network access.',
        'Bundle the resource through the validated local asset manifest.'
      )
    );
  return result;
}

async function withDeadline<T>(
  milliseconds: number,
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Rendered QA timed out.')),
    milliseconds
  );
  try {
    return await action(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function inspectRevision(input: {
  revisionId: string;
  parentRevisionId?: string | undefined;
  routes: readonly string[];
  viewports: readonly QaViewport[];
  adapter: RenderedQaLifecycleAdapter;
  timeoutMs: number;
  comparedTo?: RenderedQaReport | undefined;
}): Promise<RenderedQaReport> {
  try {
    return await withDeadline(input.timeoutMs, async (signal) => {
      await input.adapter.build(input.revisionId, signal);
      const preview = await input.adapter.launch(input.revisionId, signal);
      const captures: RenderedQaReport['captures'][number][] = [];
      const findings: RenderedQaFinding[] = [];
      try {
        const origin = loopbackUrl(preview.url);
        for (const route of input.routes) {
          for (const viewport of input.viewports) {
            const url = new URL(route, origin);
            const observation = await input.adapter.capture.capture({
              revisionId: input.revisionId,
              url: url.toString(),
              route,
              viewport,
              reducedMotion: true,
              signal
            });
            captures.push({
              route,
              viewport: viewport.id,
              screenshotPath: observation.screenshotPath,
              screenshotDigest: createHash('sha256').update(observation.screenshot).digest('hex')
            });
            findings.push(...machineFindings(input.revisionId, route, viewport, observation));
            for (const subjective of observation.humanFindings ?? []) {
              const id = createHash('sha256')
                .update(
                  JSON.stringify({ revisionId: input.revisionId, route, viewport, subjective })
                )
                .digest('hex')
                .slice(0, 20);
              findings.push({
                ...subjective,
                id: `qa:${id}`,
                kind: 'human',
                route,
                viewport: viewport.id
              });
            }
          }
        }
      } finally {
        await preview.close();
      }
      const previousErrors = new Set(
        input.comparedTo?.findings
          .filter((item) => item.severity === 'error')
          .map((item) => `${item.route}:${item.viewport}:${item.category}`) ?? []
      );
      const regressions = findings.filter(
        (item) =>
          item.severity === 'error' &&
          !previousErrors.has(`${item.route}:${item.viewport}:${item.category}`)
      );
      for (const item of regressions)
        findings.push({
          ...item,
          id: `${item.id}:regression`,
          category: 'route-regression',
          message: `Regression relative to ${input.comparedTo?.revisionId}: ${item.message}`
        });
      return {
        version: RENDERED_QA_VERSION,
        revisionId: input.revisionId,
        ...(input.parentRevisionId ? { parentRevisionId: input.parentRevisionId } : {}),
        status: findings.some((item) => item.severity === 'error')
          ? 'revision-recommended'
          : 'passed',
        routes: input.routes,
        viewports: input.viewports,
        captures,
        findings,
        ...(input.comparedTo ? { comparedToRevisionId: input.comparedTo.revisionId } : {}),
        regressionCount: regressions.length
      };
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timed out|aborted/i.test(error.message);
    const message = error instanceof Error ? error.message : String(error);
    return {
      version: RENDERED_QA_VERSION,
      revisionId: input.revisionId,
      ...(input.parentRevisionId ? { parentRevisionId: input.parentRevisionId } : {}),
      status: timedOut ? 'timed-out' : 'failed',
      routes: input.routes,
      viewports: input.viewports,
      captures: [],
      findings: [
        finding(
          input.revisionId,
          '*',
          '*',
          'capture-failure',
          'error',
          { timedOut, error: message },
          timedOut ? 'Rendered QA exceeded its lifecycle deadline.' : 'Rendered QA capture failed.',
          timedOut
            ? 'Reduce preview startup or capture work, then retry the immutable revision.'
            : 'Verify the pinned browser runtime, loopback preview, and evidence destination.'
        )
      ],
      ...(input.comparedTo ? { comparedToRevisionId: input.comparedTo.revisionId } : {}),
      regressionCount: 0
    };
  }
}

export async function runRenderedQaLifecycle(input: {
  revisionId: string;
  routes: readonly string[];
  adapter: RenderedQaLifecycleAdapter;
  viewports?: readonly QaViewport[] | undefined;
  timeoutMs?: number | undefined;
  maxChangedPaths?: number | undefined;
}): Promise<RenderedQaLifecycleResult> {
  const routes = [...new Set(input.routes.map(routeKey))];
  if (routes.length === 0)
    throw new RuntimeFailure('INVALID_REQUEST', 'Rendered QA requires approved routes.', {
      path: 'routes'
    });
  const viewports = input.viewports ?? DEFAULT_QA_VIEWPORTS;
  const initial = await inspectRevision({
    revisionId: input.revisionId,
    routes,
    viewports,
    adapter: input.adapter,
    timeoutMs: input.timeoutMs ?? 60_000
  });
  if (initial.status === 'passed') return { initial, decision: 'accepted-initial' };
  if (!input.adapter.proposeRevision) return { initial, decision: 'revision-unavailable' };
  const controller = new AbortController();
  const proposal = await input.adapter.proposeRevision(initial, controller.signal);
  if (!proposal) return { initial, decision: 'revision-unavailable' };
  if (
    proposal.parentRevisionId !== input.revisionId ||
    proposal.revisionId === proposal.parentRevisionId ||
    proposal.changedPaths.length === 0 ||
    proposal.changedPaths.length > (input.maxChangedPaths ?? 8) ||
    proposal.changedPaths.some(
      (item) =>
        !/^src\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:tsx?|css|txt)$/.test(item) || item.includes('..')
    )
  )
    throw new RuntimeFailure(
      'INVALID_REQUEST',
      'Rendered QA revision proposal is not bounded or is not linked to its immutable parent.',
      { path: 'proposal' }
    );
  const candidate = await inspectRevision({
    revisionId: proposal.revisionId,
    parentRevisionId: proposal.parentRevisionId,
    routes,
    viewports,
    adapter: input.adapter,
    timeoutMs: input.timeoutMs ?? 60_000,
    comparedTo: initial
  });
  const accepted =
    candidate.status === 'passed' &&
    candidate.regressionCount === 0 &&
    candidate.findings.filter((item) => item.severity === 'error').length <
      initial.findings.filter((item) => item.severity === 'error').length;
  return {
    initial,
    candidate,
    decision: accepted ? 'accepted-candidate' : 'rejected-candidate'
  };
}
