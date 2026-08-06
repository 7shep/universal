import { useEffect, useRef, useState } from 'react';

const repoUrl = 'https://github.com/7shep/universal';
const docsUrl = `${repoUrl}/tree/main/docs`;

const workflow = [
  { command: 'start_art_direction', label: 'Discover', title: 'Begin with decisions, not components.', copy: 'Universal reads the product context and asks only the questions that materially change the direction.', output: ['purpose', 'audience', 'page map', 'constraints'] },
  { command: 'approve_creative_brief', label: 'Align', title: 'Make the brief explicit--and approved.', copy: 'Assumptions become visible decisions. Nothing advances until the creative brief has real approval.', output: ['creative brief v1', 'decision provenance', 'approval digest'] },
  { command: 'develop_art_direction', label: 'Direct', title: 'Choose a thesis, not a theme.', copy: 'Distinct concepts are evaluated for clarity, composition, accessibility, and resistance to generic patterns.', output: ['3 distinct concepts', 'scored rationale', 'selected direction'] },
  { command: 'create_design_plan_v2', label: 'Specify', title: 'Carry intent all the way to code.', copy: 'Typography, color, composition, navigation, responsive behavior, and motion become a versioned plan.', output: ['design plan v2', 'protected invariants', 'implementation rules'] },
  { command: 'review_implementation', label: 'Critique', title: 'Review the result against the idea.', copy: 'Source and visual evidence are checked for generic defaults, broken hierarchy, and off-direction choices.', output: ['prioritized findings', 'severity + rationale', 'actionable fixes'] },
];

function GitHubIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.97 10.97 0 0 1 12 6.12c.98 0 1.95.13 2.86.38 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;
}

function Wordmark() {
  return <span className="wordmark"><img src="/assets/logo.svg" alt="Universal" /></span>;
}

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 48);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return <header className={`site-nav ${scrolled ? 'is-scrolled' : ''}`}>
    <a href="#top" aria-label="Universal home"><Wordmark /></a>
    <nav aria-label="Primary navigation"><a href="#designing">Designing</a><a href={docsUrl}>Docs</a><a className="github-link" href={repoUrl} aria-label="Universal on GitHub"><GitHubIcon /></a></nav>
  </header>;
}

function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-meta"><p>Open-source AI art director</p><p>For React + coding agents</p></div>
    <h1 id="hero-title"><span>Art direction</span><span>for agents that</span><span className="hero-accent">build React.</span></h1>
    <figure className="hero-art" aria-hidden="true"><img src="/assets/blossom-atmosphere.png" alt="" /><figcaption>Atmosphere / direction / 01</figcaption></figure>
    <div className="hero-bottom"><p>Universal gives coding agents a deliberate design direction before implementation&mdash;and a concrete critique after it.</p><a className="text-link" href="#designing">See how it works <span aria-hidden="true">&darr;</span></a></div>
    <p className="hero-index" aria-hidden="true">01 / 06</p>
  </section>;
}

function Proposition() {
  return <section className="proposition" aria-labelledby="proposition-title">
    <p className="section-label">The missing design step</p>
    <div className="proposition-copy"><h2 id="proposition-title">Coding agents can build.<br />Universal helps them decide.</h2><p>Functional code is no longer the hard part. The hard part is preserving a point of view through discovery, composition, implementation, and review.</p></div>
    <div className="argument-lines" aria-label="Universal design principles"><p><span>01</span>Direction before decoration.</p><p><span>02</span>Composition before components.</p><p><span>03</span>Evidence before approval.</p></div>
  </section>;
}

function WorkflowArtifact({ active }: { active: number }) {
  const step = workflow[active];
  return <div className="artifact" aria-live="polite">
    <div className="artifact-bar"><span>universal / session</span><span>0{active + 1}&mdash;0{workflow.length}</span></div>
    <div className="artifact-command"><span aria-hidden="true">&rsaquo;</span><code>{step.command}</code></div>
    <div className="artifact-body"><p className="artifact-status"><span /> Complete</p><p className="artifact-title">{step.title}</p><dl>{step.output.map((item, index) => <div key={item}><dt>0{index + 1}</dt><dd>{item}</dd></div>)}</dl></div>
    <div className="artifact-footer"><span>digest bound</span><span>accessible by default</span></div>
  </div>;
}

function DesigningWorkflow() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number((visible.target as HTMLElement).dataset.index));
    }, { rootMargin: '-34% 0px -44% 0px', threshold: [0, .4, .8] });
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <section className="workflow" id="designing" aria-labelledby="workflow-title">
    <header className="workflow-heading"><p className="section-label">Designing with Universal</p><h2 id="workflow-title">One continuous line<br />from intent to interface.</h2></header>
    <div className="workflow-grid"><ol className="workflow-steps">{workflow.map((step, index) => <li key={step.command} ref={(element) => { refs.current[index] = element; }} data-index={index} className={active === index ? 'is-active' : ''}><button type="button" onClick={() => setActive(index)} aria-current={active === index ? 'step' : undefined}><span className="step-number">0{index + 1}</span><span className="step-copy"><small>{step.label}</small><strong>{step.title}</strong><span>{step.copy}</span><code>{step.command}</code></span></button></li>)}</ol><div className="artifact-stage"><WorkflowArtifact active={active} /></div></div>
  </section>;
}

function BeforeAfter() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(52);
  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = section.getBoundingClientRect(); const distance = Math.max(1, rect.height - window.innerHeight);
      if (rect.top <= 0 && rect.bottom >= window.innerHeight) setProgress(Math.max(8, Math.min(92, (-rect.top / distance) * 100)));
    };
    update(); window.addEventListener('scroll', update, { passive: true }); return () => window.removeEventListener('scroll', update);
  }, []);
  return <section className="comparison" ref={sectionRef} aria-labelledby="comparison-title"><div className="comparison-sticky">
    <header><p className="section-label">The difference is directional</p><h2 id="comparison-title">Same prompt.<br />A stronger point of view.</h2></header>
    <div className="comparison-frame" style={{ '--reveal': `${progress}%` } as React.CSSProperties}>
      <div className="mockup mockup-before"><span className="mockup-label">Without direction</span><div className="generic-nav"><i /><i /><i /></div><div className="generic-hero"><b>Build the future</b><i /></div><div className="generic-tiles"><i /><i /></div></div>
      <div className="mockup mockup-after"><span className="mockup-label">With Universal</span><div className="directed-nav"><b>AXIS / 65</b><i>INDEX 01&mdash;04</i></div><div className="directed-hero"><small>BUILT FOR THE HAND</small><b>Weight.<br />Made visible.</b></div><div className="directed-proof"><i>65%</i><span>Intent becomes structure.</span></div></div>
      <div className="reveal-line" aria-hidden="true"><span>&harr;</span></div>
      <label className="comparison-control"><span>Compare before and after</span><input type="range" min="8" max="92" value={Math.round(progress)} onChange={(event) => setProgress(Number(event.target.value))} /></label>
    </div>
  </div></section>;
}

function Principles() {
  return <section className="principles" aria-labelledby="principles-title"><p className="section-label">What Universal protects</p><h2 id="principles-title">Taste you can<br />trace back.</h2><div className="principle-list"><article><span>01</span><h3>Explicit decisions</h3><p>Every major choice carries its rationale and provenance into implementation.</p></article><article><span>02</span><h3>Protected intent</h3><p>Versioned plans keep the hero, hierarchy, navigation, and responsive behavior from drifting.</p></article><article><span>03</span><h3>Actionable critique</h3><p>Review names the rule, severity, evidence, and concrete repair&mdash;not just a score.</p></article></div><p className="principles-note">Local-first &middot; open source &middot; MIT licensed</p></section>;
}

function Closing() {
  return <section className="closing" aria-labelledby="closing-title"><p className="section-label">Start with a direction</p><h2 id="closing-title">Your agent can code.<br /><em>Give it taste.</em></h2><div className="closing-actions"><a href={docsUrl}>Read the docs <span aria-hidden="true">{'↗'}</span></a><a href={repoUrl}>View on GitHub <span aria-hidden="true">{'↗'}</span></a></div><footer><a href="#top"><Wordmark /></a><p>Open-source AI art direction for React interfaces.</p><p>{'©'} {new Date().getFullYear()} Universal</p></footer></section>;
}

export function App() {
  return <main><a className="skip-link" href="#main-content">Skip to content</a><Navigation /><div id="main-content"><Hero /><Proposition /><DesigningWorkflow /><BeforeAfter /><Principles /><Closing /></div></main>;
}
