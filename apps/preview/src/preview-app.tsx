import { useEffect, useState } from 'react';
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
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const next = await client.load(projectId);
        if (!disposed) setState(next);
      } catch (error) {
        if (!disposed)
          setState({
            phase: 'failed',
            status: 'Runtime unavailable',
            heading: 'Preview could not read runtime state.',
            description: 'Return to Studio and confirm the trusted local runtime is running.',
            diagnostic: error instanceof Error ? error.message : String(error)
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
  }, [client, projectId]);
  const descriptor = state.descriptor,
    ready = state.phase === 'ready' && descriptor;
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
            <a href={descriptor.url} target="_blank" rel="noreferrer">
              Open isolated origin [open]
            </a>
          </div>
          <iframe
            title={`Generated preview for ${descriptor.projectId}`}
            src={descriptor.url}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
          />
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
          {state.diagnostic ? (
            <pre>
              <code>{state.diagnostic}</code>
            </pre>
          ) : null}
          <a href="http://127.0.0.1:5173/">Return to Studio</a>
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
