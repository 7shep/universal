import { useEffect, useMemo, useState } from 'react';
import {
  createLocalArtDirectorClient,
  type AnswerMode,
  type ArtDirectorClient,
  type BriefDecision,
  type PageDefinition,
  type Question,
  type StudioProject
} from './studio-client';
import {
  createLocalGenerationLifecycleClient,
  type GenerationLifecycleClient,
  type GenerationSnapshot
} from './runtime-client';
type Stage = 'discovery' | 'brief' | 'direction' | 'plan';
const stages: Stage[] = ['discovery', 'brief', 'direction', 'plan'];
const labels: Record<Stage, string> = {
  discovery: 'Discovery',
  brief: 'Brief',
  direction: 'Direction',
  plan: 'Plan'
};
const modes: { value: AnswerMode; label: string }[] = [
  { value: 'exact', label: 'Exact answer' },
  { value: 'preference', label: 'Preference / reference' },
  { value: 'unknown', label: 'I do not know' },
  { value: 'judgment', label: 'Use your judgment' },
  { value: 'draft', label: 'Draft this for me' }
];
const MINIMUM_BRIEF_LENGTH = 40;
function getBriefGuidance(prompt: string): { invalid: boolean; message: string } {
  const length = prompt.trim().length;
  if (length === 0) {
    return { invalid: true, message: 'Describe what you want to make.' };
  }
  if (length < MINIMUM_BRIEF_LENGTH) {
    return {
      invalid: true,
      message: `Add at least ${MINIMUM_BRIEF_LENGTH - length} more characters so discovery has enough context.`
    };
  }
  return { invalid: false, message: 'Ready to begin discovery.' };
}
const Arrow = () => <span aria-hidden="true">&rarr;</span>;
function Progress({
  stage,
  project,
  onGo
}: {
  stage: Stage;
  project: StudioProject | null;
  onGo: (s: Stage) => void;
}) {
  const unlocked: Stage[] = project?.directionApproved
    ? stages
    : project?.briefApproved
      ? stages.slice(0, 3)
      : project
        ? stages.slice(0, 2)
        : ['discovery'];
  return (
    <nav className="progress" aria-label="Project progress">
      <p>Project path</p>
      <ol>
        {stages.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              className={stage === s ? 'active' : ''}
              disabled={!unlocked.includes(s)}
              aria-current={stage === s ? 'step' : undefined}
              onClick={() => onGo(s)}
            >
              <span>0{i + 1}</span>
              {labels[s]}
            </button>
          </li>
        ))}
      </ol>
      <small>{project ? `${project.completion}% resolved` : 'Begin with what you know.'}</small>
    </nav>
  );
}
function Start({
  client,
  onStart
}: {
  client: ArtDirectorClient;
  onStart: (p: StudioProject) => void;
}) {
  const [prompt, setPrompt] = useState(
    'A membership site for Field Notes Society, a small collective that hosts guided creative retreats in overlooked landscapes.'
  );
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState('');
  const guidance = getBriefGuidance(prompt);
  async function run() {
    setTouched(true);
    if (guidance.invalid) return;
    setBusy(true);
    setFailure('');
    try {
      onStart(await client.startProject(prompt));
    } catch (error) {
      // Keep the prompt and re-enable the control so the same request can be retried.
      setFailure(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }
  return (
    <section className="start">
      <div className="start-copy">
        <p className="kicker">New commission</p>
        <h1>Bring the unfinished thought.</h1>
        <p>
          Universal finds the decisions that matter, drafts the ones you delegate, and shapes a
          direction before production begins.
        </p>
      </div>
      <div className="prompt-sheet">
        <label htmlFor="prompt">What are you making?</label>
        <textarea
          id="prompt"
          rows={7}
          value={prompt}
          required
          minLength={MINIMUM_BRIEF_LENGTH}
          aria-invalid={touched && guidance.invalid}
          aria-describedby="prompt-guidance prompt-count"
          onBlur={() => setTouched(true)}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="prompt-meta">
          <p
            id="prompt-guidance"
            className={touched && guidance.invalid ? 'prompt-error' : 'prompt-guidance'}
            role={touched && guidance.invalid ? 'alert' : undefined}
          >
            {guidance.message}
          </p>
          <small id="prompt-count">{prompt.length} characters</small>
        </div>
        {failure && (
          <p className="prompt-error" role="alert">
            <strong>Discovery could not start.</strong> {failure} Your prompt is unchanged; try
            again.
          </p>
        )}
        <div className="actions">
          <small>{prompt.trim().split(/\s+/).length} words</small>
          <button
            type="button"
            className="primary"
            disabled={guidance.invalid || busy}
            onClick={run}
          >
            {busy ? 'Preparing discovery...' : 'Begin discovery'} <Arrow />
          </button>
        </div>
      </div>
      <aside>
        <small>How this works</small>
        <p>Four focused passes. Your decisions remain visibly separate from ours.</p>
      </aside>
    </section>
  );
}
function Mode({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  return (
    <div className="modes" role="radiogroup" aria-label={`Answer mode for ${q.label}`}>
      {modes.map((m) => (
        <label key={m.value} className={q.mode === m.value ? 'selected' : ''}>
          <input
            type="radio"
            name={`mode-${q.id}`}
            checked={q.mode === m.value}
            onChange={() => onChange({ ...q, mode: m.value })}
          />
          {m.label}
        </label>
      ))}
    </div>
  );
}
function QuestionEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const text = q.mode === 'exact' || q.mode === 'preference';
  return (
    <fieldset className="question">
      <legend>
        <span>{q.label}</span>
        <small>{q.impact} impact</small>
      </legend>
      <p>{q.prompt}</p>
      <Mode q={q} onChange={onChange} />
      {text ? (
        <textarea
          aria-label={`Answer for ${q.label}`}
          rows={3}
          value={q.answer}
          placeholder={
            q.mode === 'preference'
              ? 'Describe the feeling, reference, or anti-reference.'
              : 'Write the decision clearly.'
          }
          onChange={(e) => onChange({ ...q, answer: e.target.value })}
        />
      ) : (
        <p className="delegate">
          {q.mode === 'draft'
            ? 'Universal will prepare editable copy.'
            : q.mode === 'judgment'
              ? 'Universal will make and explain this decision.'
              : 'This remains an unresolved choice.'}
        </p>
      )}
    </fieldset>
  );
}
function Field({
  label,
  value,
  multi = false,
  onChange
}: {
  label: string;
  value: string;
  multi?: boolean;
  onChange: (s: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multi ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
function PageEditor({
  page,
  onChange
}: {
  page: PageDefinition;
  onChange: (p: PageDefinition) => void;
}) {
  return (
    <details className="page" open>
      <summary>
        <span>
          <strong>{page.name}</strong>
          <small>{page.route}</small>
        </span>
        <span>Edit page map</span>
      </summary>
      <div className="page-grid">
        <Field
          label="Page name"
          value={page.name}
          onChange={(name) => onChange({ ...page, name })}
        />
        <Field
          label="Route"
          value={page.route}
          onChange={(route) => onChange({ ...page, route })}
        />
        <Field
          label="User goal"
          multi
          value={page.userGoal}
          onChange={(userGoal) => onChange({ ...page, userGoal })}
        />
        <Field
          label="Primary message"
          multi
          value={page.primaryMessage}
          onChange={(primaryMessage) => onChange({ ...page, primaryMessage })}
        />
        <Field
          label="Required sections"
          multi
          value={page.requiredSections.join(', ')}
          onChange={(v) =>
            onChange({ ...page, requiredSections: v.split(',').map((x) => x.trim()) })
          }
        />
        <Field
          label="Content requirements"
          multi
          value={page.contentRequirements}
          onChange={(contentRequirements) => onChange({ ...page, contentRequirements })}
        />
        <Field
          label="Primary action"
          value={page.primaryAction}
          onChange={(primaryAction) => onChange({ ...page, primaryAction })}
        />
        <Field
          label="Secondary action"
          value={page.secondaryAction}
          onChange={(secondaryAction) => onChange({ ...page, secondaryAction })}
        />
        <Field
          label="Navigation relationship"
          multi
          value={page.navigationRelationship}
          onChange={(navigationRelationship) => onChange({ ...page, navigationRelationship })}
        />
        <Field
          label="Unique visual responsibility"
          multi
          value={page.visualResponsibility}
          onChange={(visualResponsibility) => onChange({ ...page, visualResponsibility })}
        />
      </div>
    </details>
  );
}
function Heading({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <header className="stage-heading">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      <p>{copy}</p>
    </header>
  );
}
function Discovery({
  client,
  project,
  onChange,
  onDone
}: {
  client: ArtDirectorClient;
  project: StudioProject;
  onChange: (p: StudioProject) => void;
  onDone: (p: StudioProject) => void;
}) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const group = project.groups[index]!;
  function changeQ(next: Question) {
    onChange({
      ...project,
      groups: project.groups.map((g, i) =>
        i === index ? { ...g, questions: g.questions.map((q) => (q.id === next.id ? next : q)) } : g
      )
    });
  }
  function changePage(next: PageDefinition) {
    onChange({ ...project, pages: project.pages.map((p) => (p.id === next.id ? next : p)) });
  }
  async function advance() {
    if (index < project.groups.length - 1) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    onDone(await client.compileBrief(project));
  }
  return (
    <section className="stage">
      <Heading
        kicker={`Discovery  /  ${index + 1} of ${project.groups.length}`}
        title={group.title}
        copy={group.description}
      />
      <div className="group-tabs" aria-label="Discovery groups">
        {project.groups.map((g, i) => (
          <button key={g.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
            <span>0{i + 1}</span>
            {g.short}
          </button>
        ))}
      </div>
      <div className="question-stack">
        {group.questions.map((q) => (
          <QuestionEditor key={q.id} q={q} onChange={changeQ} />
        ))}
        {group.id === 'structure' && (
          <section className="page-map">
            <header>
              <h2>Page map</h2>
              <p>Define what every route must accomplish before deciding how it looks.</p>
            </header>
            {project.pages.map((p) => (
              <PageEditor key={p.id} page={p} onChange={changePage} />
            ))}
          </section>
        )}
      </div>
      <div className="stage-actions">
        <button className="text" disabled={!index} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        <button className="primary" disabled={busy} onClick={advance}>
          {index === project.groups.length - 1
            ? busy
              ? 'Compiling brief...'
              : 'Review the brief'
            : 'Next question group'}{' '}
          <Arrow />
        </button>
      </div>
    </section>
  );
}
const provenance: Record<BriefDecision['provenance'], string> = {
  user: 'Your decisions',
  universal: 'Universal recommends',
  delegated: 'Delegated decisions',
  unresolved: 'Needs attention'
};
function Brief({
  client,
  project,
  onBack,
  onDone
}: {
  client: ArtDirectorClient;
  project: StudioProject;
  onBack: () => void;
  onDone: (p: StudioProject) => void;
}) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(
    () =>
      (Object.keys(provenance) as BriefDecision['provenance'][]).map((kind) => ({
        kind,
        items: project.brief.filter((x) => x.provenance === kind)
      })),
    [project.brief]
  );
  const open = project.brief.filter((x) => x.provenance === 'unresolved').length;
  async function approve() {
    setBusy(true);
    onDone(await client.approveBrief(project));
  }
  return (
    <section className="stage">
      <Heading
        kicker="Brief review"
        title="One brief. Clear authorship."
        copy="Check what came from you, what Universal recommends, and what you intentionally left in our hands."
      />
      {open > 0 && (
        <aside className="alert">
          <strong>{open} high-impact choice remains open.</strong>
          <p>Return to discovery or approve with this uncertainty acknowledged.</p>
        </aside>
      )}
      <div className="ledger">
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.kind}>
                <h2>{provenance[g.kind]}</h2>
                <div>
                  {g.items.map((x) => (
                    <article key={x.id}>
                      <span>{x.category}</span>
                      <h3>{x.title}</h3>
                      <p>{x.value}</p>
                      {x.rationale && <small>{x.rationale}</small>}
                    </article>
                  ))}
                </div>
              </section>
            )
        )}
      </div>
      <label className="approval">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          <strong>I approve this brief as the basis for art direction.</strong>
          <small>Delegated decisions will be resolved and explained by Universal.</small>
        </span>
      </label>
      <div className="stage-actions">
        <button className="text" onClick={onBack}>
          Revise discovery
        </button>
        <button className="primary" disabled={!ok || busy} onClick={approve}>
          {busy ? 'Developing direction...' : 'Approve brief'} <Arrow />
        </button>
      </div>
    </section>
  );
}
function DirectionView({
  client,
  project,
  onBack,
  onDone
}: {
  client: ArtDirectorClient;
  project: StudioProject;
  onBack: () => void;
  onDone: (p: StudioProject) => void;
}) {
  const d = project.direction!;
  const [busy, setBusy] = useState(false);
  async function approve() {
    setBusy(true);
    onDone(await client.approveDirection(project));
  }
  return (
    <section className="stage direction">
      <header className="direction-hero">
        <p className="kicker">Recommended direction</p>
        <span>01 / 03</span>
        <h1>{d.name}</h1>
        <p className="spine">{d.conceptSpine}</p>
      </header>
      <div className="direction-body">
        <section className="rationale">
          <h2>Why this direction</h2>
          <p>{d.rationale}</p>
        </section>
        <section className="visuals">
          <h2>Major visual decisions</h2>
          <ol>
            {d.visualDecisions.map((x, i) => (
              <li key={x.title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{x.title}</h3>
                  <p>{x.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="risks">
          <h2>Risks & tradeoffs</h2>
          <ul>
            {d.risks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="alternatives">
          <header>
            <h2>Other viable directions</h2>
            <p>Available if the recommended spine feels wrong - not merely unfamiliar.</p>
          </header>
          {d.alternatives.map((x) => (
            <details key={x.name}>
              <summary>{x.name}</summary>
              <p>{x.summary}</p>
            </details>
          ))}
        </section>
      </div>
      <div className="stage-actions">
        <button className="text" onClick={onBack}>
          Revise brief
        </button>
        <button className="primary" disabled={busy} onClick={approve}>
          {busy ? 'Preparing plan...' : 'Approve direction'} <Arrow />
        </button>
      </div>
    </section>
  );
}
const terminalGenerationStates = new Set(['idle', 'ready', 'failed', 'cancelled', 'interrupted']);
const generationLabels: Record<GenerationSnapshot['status'], string> = {
  idle: 'Not generated',
  queued: 'Queued',
  generating: 'Generating React',
  materializing: 'Materializing safely',
  installing: 'Installing locked dependencies',
  building: 'Building production output',
  reviewing: 'Reviewing implementation',
  ready: 'Preview ready',
  failed: 'Generation failed',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted'
};
function GenerationLifecycle({
  client,
  project,
  previewShellUrl
}: {
  client: GenerationLifecycleClient;
  project: StudioProject;
  previewShellUrl: string;
}) {
  const [snapshot, setSnapshot] = useState<GenerationSnapshot | null>(null),
    [clientError, setClientError] = useState('');
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const next = await client.load(project);
        if (!disposed) {
          setSnapshot(next);
          setClientError('');
        }
      } catch (error) {
        if (!disposed) setClientError(error instanceof Error ? error.message : String(error));
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [client, project]);
  const act = async (action: () => Promise<GenerationSnapshot>) => {
    setClientError('');
    try {
      setSnapshot(await action());
    } catch (error) {
      setClientError(error instanceof Error ? error.message : String(error));
    }
  };
  const status = snapshot?.status ?? 'idle',
    active = !terminalGenerationStates.has(status),
    previewProjectId = `project:${project.id}`;
  return (
    <section className="generation-lifecycle" aria-labelledby="generation-title">
      <div className="generation-heading">
        <div>
          <p className="kicker">Trusted local runtime</p>
          <h2 id="generation-title">From approved plan to isolated preview.</h2>
        </div>
        <p
          className="generation-status"
          data-state={status}
          role={status === 'failed' ? 'alert' : 'status'}
        >
          <span aria-hidden="true">
            {active ? '◌' : status === 'ready' ? '✓' : status === 'failed' ? '×' : '—'}
          </span>
          {generationLabels[status]}
        </p>
      </div>
      <div className="generation-grid">
        <div className="generation-narrative">
          <p>
            The runtime validates every binding, writes only inside its workspace, installs the
            fixed lockfile, builds immutable output, and serves successful artifacts from a separate
            loopback origin.
          </p>
          {snapshot?.buildId ? (
            <code>Build / {snapshot.buildId}</code>
          ) : (
            <code>Plan / {project.enginePlan?.digest ?? project.plan?.version}</code>
          )}
        </div>
        <ol className="generation-steps">
          <li data-current={status === 'generating' || status === 'queued'}>
            <span>01</span>Generate
          </li>
          <li data-current={status === 'materializing' || status === 'installing'}>
            <span>02</span>Validate & install
          </li>
          <li data-current={status === 'building' || status === 'reviewing'}>
            <span>03</span>Build & review
          </li>
          <li data-current={status === 'ready'}>
            <span>04</span>Preview
          </li>
        </ol>
      </div>
      {snapshot?.newerFailure && snapshot.currentPreview ? (
        <div className="last-good">
          <strong>Current preview retained</strong>
          <p>A newer attempt failed: {snapshot.newerFailure.message}</p>
        </div>
      ) : null}
      {clientError ? (
        <p className="runtime-diagnostic" role="alert">
          {clientError}
        </p>
      ) : null}
      {snapshot?.diagnostics.length ? (
        <details className="runtime-details">
          <summary>Runtime diagnostics ({snapshot.diagnostics.length})</summary>
          <ul>
            {snapshot.diagnostics.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="generation-actions">
        {active && snapshot?.operationId ? (
          <button
            className="text"
            onClick={() => void act(() => client.cancel(project, snapshot.operationId!))}
          >
            Cancel operation
          </button>
        ) : null}
        {snapshot?.currentPreview ? (
          <a
            className="primary preview-link"
            href={`${previewShellUrl}?projectId=${encodeURIComponent(previewProjectId)}`}
          >
            Open isolated preview <Arrow />
          </a>
        ) : (
          <button
            className="primary"
            disabled={active}
            onClick={() => void act(() => client.start(project))}
          >
            {status === 'failed' && snapshot?.retryable
              ? 'Retry generation'
              : 'Generate React site'}{' '}
            <Arrow />
          </button>
        )}
      </div>
    </section>
  );
}
function Plan({
  project,
  generationClient,
  previewShellUrl
}: {
  project: StudioProject;
  generationClient: GenerationLifecycleClient;
  previewShellUrl: string;
}) {
  const p = project.plan!;
  return (
    <section className="stage plan">
      <Heading kicker="Design Plan v2" title={p.title} copy={p.thesis} />
      <div className="plan-meta">
        <span>Plan {p.version}</span>
        <span>{p.status}</span>
        <span>{p.pages.length} routes</span>
        <span>{p.confidence}% confidence</span>
      </div>
      <div className="plan-doc">
        <section>
          <h2>Creative direction</h2>
          <dl>
            <div>
              <dt>Concept spine</dt>
              <dd>{p.conceptSpine}</dd>
            </div>
            <div>
              <dt>Visual system</dt>
              <dd>{p.visualSystem}</dd>
            </div>
            <div>
              <dt>Interaction principle</dt>
              <dd>{p.interactionPrinciple}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h2>Tokens</h2>
          <div className="tokens">
            {p.tokens.map((t) => (
              <div key={t.name}>
                <i style={t.type === 'color' ? { background: t.value } : undefined} />
                <strong>{t.name}</strong>
                <code>{t.value}</code>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>Page specifications</h2>
          {p.pages.map((page) => (
            <article className="plan-page" key={page.route}>
              <header>
                <h3>{page.name}</h3>
                <code>{page.route}</code>
              </header>
              <p>{page.intent}</p>
              <ol>
                {page.sections.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>
                    <span>{s.responsibility}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
        <section>
          <h2>Accessibility & constraints</h2>
          <ul className="constraints">
            {p.constraints.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>
      <GenerationLifecycle
        client={generationClient}
        project={project}
        previewShellUrl={previewShellUrl}
      />
      <footer className="plan-footer">
        <div>
          <strong>Direction approved</strong>
          <span>Approved creative provenance is locked for generation.</span>
        </div>
        <button className="secondary" onClick={() => window.print()}>
          Print plan
        </button>
      </footer>
    </section>
  );
}
export interface StudioAppProps {
  client?: ArtDirectorClient;
  generationClient?: GenerationLifecycleClient;
  previewShellUrl?: string;
}

export function StudioApp({
  client: suppliedClient,
  generationClient: suppliedGenerationClient,
  previewShellUrl = 'http://127.0.0.1:5174/'
}: StudioAppProps = {}) {
  const client = useMemo(() => suppliedClient ?? createLocalArtDirectorClient(), [suppliedClient]);
  const generationClient = useMemo(
    () => suppliedGenerationClient ?? createLocalGenerationLifecycleClient(),
    [suppliedGenerationClient]
  );
  const [stage, setStage] = useState<Stage>('discovery');
  const [project, setProject] = useState<StudioProject | null>(null);
  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Universal home">
          UNIVERSAL
        </a>
        <span>Studio / Phase 3</span>
        <span>{project?.name || 'Untitled project'}</span>
      </header>
      <Progress stage={stage} project={project} onGo={setStage} />
      <main id="content" className="content">
        {!project ? (
          <Start
            client={client}
            onStart={(p) => {
              setProject(p);
              setStage('discovery');
            }}
          />
        ) : stage === 'discovery' ? (
          <Discovery
            client={client}
            project={project}
            onChange={setProject}
            onDone={(p) => {
              setProject(p);
              setStage('brief');
            }}
          />
        ) : stage === 'brief' ? (
          <Brief
            client={client}
            project={project}
            onBack={() => setStage('discovery')}
            onDone={(p) => {
              setProject(p);
              setStage('direction');
            }}
          />
        ) : stage === 'direction' ? (
          <DirectionView
            client={client}
            project={project}
            onBack={() => setStage('brief')}
            onDone={(p) => {
              setProject(p);
              setStage('plan');
            }}
          />
        ) : (
          <Plan
            project={project}
            generationClient={generationClient}
            previewShellUrl={previewShellUrl}
          />
        )}
      </main>
      <div className="perimeter" aria-hidden="true">
        Art direction before implementation
      </div>
    </div>
  );
}
