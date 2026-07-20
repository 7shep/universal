import { useState } from 'react';

/**
 * Fixture data for the Preview app's lifecycle states, inlined here so the
 * whole feature lives in one file. No process execution, no URL loading, no
 * runtime communication. When a real preview protocol exists, whatever
 * drives it can compute a `PreviewStateKey` (and, for the error state, a
 * diagnostic string) and feed it into the single `useState` below — nothing
 * else needs to change.
 */

type PreviewSeverity = 'idle' | 'progress' | 'warning' | 'error';

type PreviewStateKey = 'no-project' | 'loading' | 'build-unavailable' | 'runtime-error';

interface PreviewStateAction {
  label: string;
}

interface PreviewStateFixture {
  key: PreviewStateKey;
  eyebrow: string;
  statusLabel: string;
  severity: PreviewSeverity;
  heading: string;
  description: string;
  diagnostic?: string;
  action?: PreviewStateAction;
}

const PREVIEW_STATE_ORDER: PreviewStateKey[] = [
  'no-project',
  'loading',
  'build-unavailable',
  'runtime-error'
];

const PREVIEW_STATE_FIXTURES: Record<PreviewStateKey, PreviewStateFixture> = {
  'no-project': {
    key: 'no-project',
    eyebrow: 'Universal / Preview',
    statusLabel: 'Status: Idle',
    severity: 'idle',
    heading: 'No project selected',
    description:
      'This isolated surface will render generated React projects in a future milestone. Choose a project to see its preview here.'
  },
  loading: {
    key: 'loading',
    eyebrow: 'Universal / Preview',
    statusLabel: 'Status: Loading',
    severity: 'progress',
    heading: 'Preparing preview…',
    description:
      "We're bundling the generated project so it can render here. This usually takes a few seconds."
  },
  'build-unavailable': {
    key: 'build-unavailable',
    eyebrow: 'Universal / Preview',
    statusLabel: 'Status: Unavailable',
    severity: 'warning',
    heading: 'Build unavailable',
    description:
      "This project doesn't have a build we can preview yet. Finish the build step, then check again.",
    diagnostic: 'Diagnostic: no build artifact found for this project.',
    action: { label: 'Check again' }
  },
  'runtime-error': {
    key: 'runtime-error',
    eyebrow: 'Universal / Preview',
    statusLabel: 'Status: Error',
    severity: 'error',
    heading: "Preview couldn't start",
    description:
      'Something in the generated project stopped the preview from running. Fix the error below, then try again.',
    diagnostic:
      "Diagnostic: TypeError — Cannot read properties of undefined (reading 'map') at src/App.tsx:42",
    action: { label: 'Try again' }
  }
};

/**
 * A small glyph per severity, distinct in shape (not just color), so the
 * status reads correctly for anyone who can't rely on color to tell states
 * apart. Purely decorative — the real status text lives in `statusLabel`.
 */
function StatusGlyph({ severity }: { severity: PreviewSeverity }) {
  switch (severity) {
    case 'idle':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="status-glyph">
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3.2"
          />
        </svg>
      );
    case 'progress':
      return (
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          className="status-glyph status-glyph--spin"
        >
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="14 30"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="status-glyph">
          <path
            d="M12 3 L21.5 20 H2.5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="12"
            y1="9"
            x2="12"
            y2="14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17.2" r="1" fill="currentColor" />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="status-glyph">
          <path
            d="M8.5 2.5h7L21.5 8.5v7L15.5 21.5h-7L2.5 15.5v-7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="9"
            y1="9"
            x2="15"
            y2="15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function PreviewApp() {
  // Local-only state selection. This `useState` is the entire seam a future
  // runtime protocol needs to replace: swap it for whatever reports real
  // project/build/runtime status and compute a `PreviewStateKey` (plus a
  // diagnostic string for errors). Every fixture below already renders from
  // `state`, so nothing else here has to change.
  const [state, setState] = useState<PreviewStateKey>('no-project');
  const fixture = PREVIEW_STATE_FIXTURES[state];
  const isErrorLike = fixture.severity === 'error';

  // Intentionally inert. This issue only adds fixture-driven UI states — no
  // process execution, URL loading, or runtime communication. A future
  // protocol wires this to a real rebuild/retry call.
  function handleAction() {}

  return (
    <main>
      <div
        className="preview-panel"
        data-severity={fixture.severity}
        role={isErrorLike ? 'alert' : 'status'}
        aria-live={isErrorLike ? 'assertive' : 'polite'}
      >
        <p className="eyebrow">{fixture.eyebrow}</p>

        <div className="status-row">
          <StatusGlyph severity={fixture.severity} />
          <span className="status-label">{fixture.statusLabel}</span>
        </div>

        <h1>{fixture.heading}</h1>
        <p className="description">{fixture.description}</p>

        {fixture.diagnostic ? (
          <pre className="diagnostic">
            <code>{fixture.diagnostic}</code>
          </pre>
        ) : null}

        {fixture.action ? (
          <div className="actions">
            <button type="button" className="action-button" onClick={handleAction}>
              {fixture.action.label}
            </button>
          </div>
        ) : null}
      </div>

      <fieldset className="state-switcher">
        <legend>Preview state (local fixture, dev only)</legend>
        {PREVIEW_STATE_ORDER.map((key) => (
          <label key={key} className="state-switcher__option">
            <input
              type="radio"
              name="preview-state"
              value={key}
              checked={state === key}
              onChange={() => setState(key)}
            />
            {PREVIEW_STATE_FIXTURES[key].heading}
          </label>
        ))}
      </fieldset>
    </main>
  );
}
