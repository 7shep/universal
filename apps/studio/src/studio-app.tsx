import { Button } from '@universal/ui';

const stages = ['Brief', 'Direction', 'Composition', 'Critique', 'Preview'];

export function StudioApp() {
  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          Universal
        </a>
        <span>Design before code.</span>
      </header>
      <section className="intro">
        <p className="label">New direction</p>
        <h1>Start with a point of view.</h1>
        <p className="lede">
          Turn a product thought into a legible design direction before any React code exists.
        </p>
      </section>
      <section className="workspace" aria-label="New design direction">
        <div className="brief-panel">
          <label htmlFor="brief">What are you making?</label>
          <textarea id="brief" placeholder="A thoughtful prompt belongs here." rows={6} />
          <div className="actions">
            <Button disabled title="Generation is not available in this foundation release">
              Develop direction
            </Button>
            <span>Engine coming soon</span>
          </div>
        </div>
        <ol className="stages">
          {stages.map((stage, index) => (
            <li key={stage} className={index === 0 ? 'active' : ''}>
              <span>{index + 1}</span>
              {stage}
            </li>
          ))}
        </ol>
      </section>
      <footer>
        <span>Foundation release</span>
        <span>Local-first · React-native output · No generation yet</span>
      </footer>
    </main>
  );
}
