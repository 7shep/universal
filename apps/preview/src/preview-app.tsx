import { useCallback, useEffect, useState } from 'react';
import { loadingPreviewState, type PreviewClient, type PreviewViewState } from './preview-client';

const glyph: Record<PreviewViewState['phase'], string> = {
  'no-selection': ' - ',
  loading: '::',
  building: '::',
  ready: 'OK',
  unavailable: '!',
  cancelled: 'X',
  failed: 'X'
};
const viewports = [
  { id: 'desktop', label: 'Desktop', width: null },
  { id: 'mobile', label: 'Mobile', width: 390 }
] as const;
type ViewportId = (typeof viewports)[number]['id'];
export function PreviewApp({ client, projectId }: { client: PreviewClient; projectId?: string }) {
  const [state, setState] = useState<PreviewViewState>(
    projectId
      ? loadingPreviewState
      : {
          phase: 'no-selection',
          status: 'No selection',
          heading: 'Choose a generated project.',
          description:
            'Preview opens only a successful immutable build issued by the trusted local runtime.'
        }
  );
  const [viewport, setViewport] = useState<ViewportId>('desktop');
  // Bumped to force the frame to remount, and to re-poll the runtime immediately.
  const [reloadCount, setReloadCount] = useState(0);
  // A poll that fails after a diagnostic has been shown must not erase it; the
  // operator needs the last explanation to survive a transient refresh.
  const [lastDiagnostic, setLastDiagnostic] = useState('');
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const next = await client.load(projectId);
        if (disposed) return;
        setState(next);
        if (next.diagnostic) setLastDiagnostic(next.diagnostic);
        else if (next.phase === 'ready') setLastDiagnostic('');
      } catch (error) {
        if (disposed) return;
        const diagnostic = error instanceof Error ? error.message : String(error);
        setLastDiagnostic(diagnostic);
        setState({
          phase: 'failed',
          status: 'Runtime unavailable',
          heading: 'Preview could not read runtime state.',
          description: 'Return to Studio and confirm the trusted local runtime is running.',
          diagnostic
        });
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1200);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [client, projectId, reloadCount]);
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const descriptor = state.descriptor,
    ready = state.phase === 'ready' && descriptor,
    diagnostic = state.diagnostic ?? (state.phase === 'ready' ? '' : lastDiagnostic),
    currentViewport = viewports.find((option) => option.id === viewport) ?? viewports[0];
  return (
    <main className={ready ? 'preview-shell preview-shell--ready' : 'preview-shell'}>
      <header className="preview-masthead">
        <a href="/" className="preview-wordmark">
          UNIVERSAL
        </a>
        <div>
          <span>Preview / Phase 3</span>
          <strong>{projectId ?? 'No project selected'}</strong>
        </div>
        <p
          className="preview-status"
          data-phase={state.phase}
          role={state.phase === 'failed' ? 'alert' : 'status'}
        >
          <span aria-hidden="true">{glyph[state.phase]}</span>
          {state.status}
        </p>
      </header>
      {state.newerFailure ? (
        <aside className="failure-ribbon" role="alert">
          <strong>Current preview retained.</strong>
          <span>
            Newer attempt: {state.newerFailure.code} / {state.newerFailure.message}
          </span>
        </aside>
      ) : null}
      {ready ? (
        <section className="preview-stage" aria-label="Generated website preview">
          <div className="preview-meta">
            <span>Build {descriptor.buildId}</span>
            <span>Revision {descriptor.revisionId}</span>
            <div className="viewport-controls" role="group" aria-label="Preview width">
              {viewports.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={viewport === option.id}
                  onClick={() => setViewport(option.id)}
                >
                  {option.label}
                  {option.width ? ` ${option.width}` : ''}
                </button>
              ))}
            </div>
            <button type="button" className="reload" onClick={reload}>
              Reload preview
            </button>
            <a href={descriptor.url} target="_blank" rel="noreferrer">
              Open isolated origin [open]
            </a>
          </div>
          <div className="preview-frame" data-viewport={viewport}>
            <iframe
              key={`${descriptor.buildId}:${reloadCount}`}
              title={`Generated preview for ${descriptor.projectId}`}
              src={descriptor.url}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              style={currentViewport.width ? { width: `${currentViewport.width}px` } : undefined}
            />
          </div>
        </section>
      ) : (
        <section
          className="preview-empty"
          data-phase={state.phase}
          role={state.phase === 'failed' ? 'alert' : 'status'}
          aria-live={state.phase === 'failed' ? 'assertive' : 'polite'}
        >
          <p className="preview-index">
            {glyph[state.phase]} / {state.status}
          </p>
          <h1>{state.heading}</h1>
          <p>{state.description}</p>
          {diagnostic ? (
            <pre>
              <code>{diagnostic}</code>
            </pre>
          ) : null}
          <div className="preview-recovery">
            <button type="button" className="reload" onClick={reload}>
              Retry now
            </button>
            <a href="http://127.0.0.1:5173/">Return to Studio</a>
          </div>
        </section>
      )}
      <footer className="preview-footer">
        <span>Sandbox / scripts only</span>
        <span>Outbound network / denied</span>
        <span>Runtime APIs / separate origin</span>
      </footer>
    </main>
  );
}
