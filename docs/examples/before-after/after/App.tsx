export default function App() {
  return (
    <div className="page">
      <header className="masthead">
        <span className="wordmark">Acme</span>
        <ul className="masthead-index">
          <li>01. Platform</li>
          <li>02. Pricing</li>
          <li>03. Contact</li>
        </ul>
      </header>

      <section className="opener">
        <p className="opener-context">Infrastructure for teams that ship daily</p>
        <h1 className="opener-headline">
          Acme runs the boring parts of your stack so your team doesn&rsquo;t have to.
        </h1>
        <p className="opener-support">
          Deploys, rollbacks, and on-call routing for 40,000 services, without a dashboard you have
          to learn first.
        </p>
      </section>

      <section className="capability-row" id="fast">
        <h2 className="capability-number">01</h2>
        <div className="capability-copy">
          <h3>Deploys land in under four seconds</h3>
          <p>
            Acme precompiles the delta between revisions instead of rebuilding whole images, so a
            one-line fix reaches production before your terminal prompt returns.
          </p>
        </div>
      </section>

      <section className="capability-row capability-row--reverse" id="secure">
        <h2 className="capability-number">02</h2>
        <div className="capability-copy">
          <h3>Every credential is scoped to one deploy</h3>
          <p>
            Secrets are minted per revision and revoked the moment it&rsquo;s replaced. There is no
            standing production credential for an attacker to find.
          </p>
        </div>
      </section>

      <section className="capability-row" id="scale">
        <h2 className="capability-number">03</h2>
        <div className="capability-copy">
          <h3>One config scales from one region to twelve</h3>
          <p>
            The same service definition that runs your staging box replicates across regions with a
            single flag, and Acme handles the routing changes underneath it.
          </p>
        </div>
      </section>

      <footer className="colophon">
        <p>Acme Inc., est. 2019.</p>
      </footer>
    </div>
  );
}
