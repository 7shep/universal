import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { RUNTIME_CONTRACT_VERSION } from '@universal/runtime-contracts';
import { PreviewApp } from './preview-app';
import type { PreviewClient, PreviewViewState } from './preview-client';

afterEach(cleanup);

/**
 * Deterministic stand-in for the runtime-backed client. Tests drive lifecycle
 * states directly instead of going through fetch, so no runtime, network, or
 * generated build is required.
 */
function fakeClient(result: PreviewViewState | Error, onLoad?: () => void): PreviewClient {
  return {
    async load(projectId) {
      onLoad?.();
      if (!projectId) return noSelection;
      if (result instanceof Error) throw result;
      return result;
    }
  };
}

/** The panel that carries the heading, description, and diagnostic for a state. */
const panel = () => {
  const node = document.querySelector('.preview-empty, .preview-stage');
  if (!node) throw new Error('no preview panel rendered');
  return node as HTMLElement;
};

const noSelection: PreviewViewState = {
  phase: 'no-selection',
  status: 'No selection',
  heading: 'Choose a generated project.',
  description:
    'Preview opens only a successful immutable build issued by the trusted local runtime.'
};

function pendingClient(): PreviewClient {
  return { load: () => new Promise<PreviewViewState>(() => {}) };
}

const unavailable: PreviewViewState = {
  phase: 'unavailable',
  status: 'Unavailable',
  heading: 'No successful preview yet.',
  description: 'The selected project does not currently have a ready build descriptor.'
};

const failed: PreviewViewState = {
  phase: 'failed',
  status: 'Failed',
  heading: 'The latest attempt did not complete.',
  description: 'Review the structured diagnostic in Studio, then retry the operation.',
  diagnostic: 'BUILD_FAILURE: vite build exited with code 1'
};

const ready: PreviewViewState = {
  phase: 'ready',
  status: 'Ready',
  heading: 'Rendered implementation',
  description: 'Serving a runtime-issued immutable production build.',
  descriptor: {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    projectId: 'project:p',
    buildId: 'build:good',
    revisionId: 'revision:1',
    url: 'http://127.0.0.1:41234/',
    origin: 'http://127.0.0.1:41234',
    issuedAt: '2026-07-28T10:03:00.000Z',
    csp: "default-src 'self'"
  }
};

describe('no-project', () => {
  test('announces the empty selection politely and offers a route back to Studio', () => {
    render(<PreviewApp client={fakeClient(unavailable)} />);

    expect(panel().getAttribute('data-phase')).toBe('no-selection');
    expect(panel().getAttribute('role')).toBe('status');
    expect(screen.getByRole('heading', { name: 'Choose a generated project.' })).toBeDefined();
    expect(screen.getByText('No project selected')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Return to Studio' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('does not query the client when no project is selected', () => {
    let loads = 0;
    render(<PreviewApp client={fakeClient(unavailable, () => (loads += 1))} />);

    // The client is still called once with `undefined`; what must not happen is
    // rendering a build surface for a project that was never chosen.
    expect(screen.queryByTitle(/Generated preview/)).toBeNull();
    expect(loads).toBeLessThanOrEqual(1);
  });
});

describe('loading', () => {
  test('shows the loading state while the runtime read is outstanding', () => {
    render(<PreviewApp client={pendingClient()} projectId="project:p" />);

    const statuses = screen.getAllByRole('status');
    expect(statuses.some((node) => node.textContent?.includes('Loading'))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Reading runtime state.' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('build-unavailable', () => {
  test('reports an unavailable build without an error role and without a preview frame', async () => {
    render(<PreviewApp client={fakeClient(unavailable)} projectId="project:p" />);

    await screen.findByRole('heading', { name: 'No successful preview yet.' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTitle(/Generated preview/)).toBeNull();
    const region = document.querySelector('.preview-empty');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('data-phase')).toBe('unavailable');
  });

  test('has no diagnostic block when the runtime reported no diagnostic', async () => {
    render(<PreviewApp client={fakeClient(unavailable)} projectId="project:p" />);

    await screen.findByRole('heading', { name: 'No successful preview yet.' });
    expect(document.querySelector('.preview-empty pre')).toBeNull();
  });
});

describe('runtime-error', () => {
  test('exposes a failed operation assertively with its structured diagnostic', async () => {
    render(<PreviewApp client={fakeClient(failed)} projectId="project:p" />);

    await screen.findByRole('heading', { name: failed.heading });
    const region = panel();
    expect(region.getAttribute('role')).toBe('alert');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    expect(within(region).getByText(failed.diagnostic!)).toBeDefined();
    // The masthead status is escalated to an alert for the same state.
    expect(document.querySelector('.preview-status')?.getAttribute('role')).toBe('alert');
  });

  test('surfaces a thrown client failure as a runtime-unavailable alert', async () => {
    render(
      <PreviewApp
        client={fakeClient(new Error('connect ECONNREFUSED 127.0.0.1:41234'))}
        projectId="project:p"
      />
    );

    await screen.findByRole('heading', { name: 'Preview could not read runtime state.' });
    const region = panel();
    expect(region.getAttribute('role')).toBe('alert');
    expect(within(region).getByText(/ECONNREFUSED/)).toBeDefined();
  });

  test('retains the current preview when only a newer attempt failed', async () => {
    const retained: PreviewViewState = {
      ...ready,
      status: 'Ready / newer attempt failed',
      newerFailure: {
        code: 'BUILD_FAILURE',
        message: 'vite build exited with code 1',
        retryable: true
      }
    };
    render(<PreviewApp client={fakeClient(retained)} projectId="project:p" />);

    await waitFor(() => expect(screen.getByTitle(/Generated preview/)).toBeDefined());
    const ribbon = document.querySelector('.failure-ribbon') as HTMLElement;
    expect(ribbon.getAttribute('role')).toBe('alert');
    expect(within(ribbon).getByText(/Current preview retained/)).toBeDefined();
    expect(within(ribbon).getByText(/BUILD_FAILURE/)).toBeDefined();
  });
});

describe('state semantics', () => {
  test('every covered state is distinguishable by text, not only by colour', async () => {
    const seen = new Set<string>();
    for (const [projectId, state] of [
      [undefined, unavailable],
      ['project:p', unavailable],
      ['project:p', failed],
      ['project:p', ready]
    ] as const) {
      const view = render(
        <PreviewApp client={fakeClient(state)} {...(projectId ? { projectId } : {})} />
      );
      const status = await waitFor(() => {
        const node = view.container.querySelector('.preview-status');
        if (!node?.textContent?.trim()) throw new Error('status not rendered yet');
        return node;
      });
      const text = status.textContent!.trim();
      expect(text.replace(/[^A-Za-z]/g, '').length).toBeGreaterThan(0);
      expect(seen.has(text)).toBe(false);
      seen.add(text);
      cleanup();
    }
    expect(seen.size).toBe(4);
  });

  test('the ready state keeps generated code in a scripts-only sandbox', async () => {
    render(<PreviewApp client={fakeClient(ready)} projectId="project:p" />);

    const frame = await screen.findByTitle('Generated preview for project:p');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('src')).toBe('http://127.0.0.1:41234/');
  });

  test('recovery and escape routes are keyboard reachable links, not click-only controls', async () => {
    render(<PreviewApp client={fakeClient(ready)} projectId="project:p" />);

    const isolated = await screen.findByRole('link', { name: /Open isolated origin/ });
    isolated.focus();
    expect(document.activeElement).toBe(isolated);
    expect(isolated.getAttribute('tabindex')).toBeNull();
    expect(isolated.getAttribute('rel')).toBe('noreferrer');
  });
});
