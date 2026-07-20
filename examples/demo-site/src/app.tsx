import { useEffect, useRef, useState } from 'react';

type LayerProps = { name: string; detail: string; className: string };

const specifications = [
  ['Format', '65% / 67 keys'],
  ['Case', 'CNC 6063 aluminum / 1.42 kg'],
  ['Mount', 'Gasket rail isolation'],
  ['Plate', '1.5 mm bead-blasted steel'],
  ['PCB', 'Hotswap / QMK + VIA'],
  ['Acoustics', 'Poron / IXPE / PET stack']
];

function KeyboardShape({ className, type }: { className: string; type: string }) {
  const keys = Array.from({ length: 62 });
  return (
    <div className={`keyboard-shape ${className}`} aria-hidden="true">
      <div className={`keyboard-body ${type}`}>
        {type === 'caps' && (
          <div className="key-field">
            {keys.map((_, index) => (
              <i key={index} className={`key key-${index}`} />
            ))}
          </div>
        )}
        {type === 'switches' && (
          <div className="switch-field">
            {keys.map((_, index) => (
              <i key={index} />
            ))}
          </div>
        )}
        {type === 'pcb' && (
          <>
            <div className="circuit-lines" />
            <div className="pcb-chip chip-a" />
            <div className="pcb-chip chip-b" />
          </>
        )}
        {type === 'plate' && (
          <div className="plate-cutouts">
            {keys.map((_, index) => (
              <i key={index} />
            ))}
          </div>
        )}
        {type === 'chassis' && (
          <>
            <div className="chassis-well" />
            <span className="chassis-mark">AXIS / 65</span>
          </>
        )}
      </div>
    </div>
  );
}

function LayerLabel({ name, detail, className }: LayerProps) {
  return (
    <div className={`layer-label ${className}`}>
      <span>{name}</span>
      <b>{detail}</b>
    </div>
  );
}

function ExplodedKeyboard() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const available = Math.max(node.offsetHeight - window.innerHeight, 1);
      setProgress(Math.min(1, Math.max(0, -rect.top / available)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="exploded-section"
      id="construction"
      style={{ '--progress': progress } as React.CSSProperties}
    >
      <div className="exploded-pin">
        <header className="exploded-heading">
          <p>Construction / 01</p>
          <h2>
            Precision,
            <br />
            unstacked.
          </h2>
        </header>
        <div
          className="keyboard-stage"
          aria-label="AXIS 65 keyboard separating into five construction layers as the page scrolls"
        >
          <KeyboardShape className="layer chassis-layer" type="chassis" />
          <KeyboardShape className="layer pcb-layer" type="pcb" />
          <KeyboardShape className="layer switches-layer" type="switches" />
          <KeyboardShape className="layer plate-layer" type="plate" />
          <KeyboardShape className="layer caps-layer" type="caps" />
          <div className="stage-orbit" aria-hidden="true" />
        </div>
        <aside className="layer-labels" aria-label="Keyboard component annotations">
          <LayerLabel className="label-caps" name="01 / Keycaps" detail="PBT · dye-sub" />
          <LayerLabel className="label-plate" name="02 / Plate" detail="1.5 mm steel" />
          <LayerLabel className="label-switches" name="03 / Switches" detail="Linear · 55g" />
          <LayerLabel className="label-pcb" name="04 / PCB" detail="Hotswap · FR4" />
          <LayerLabel className="label-chassis" name="05 / Chassis" detail="6063 aluminum" />
        </aside>
        <p className="scroll-cue">
          Scroll to separate <span aria-hidden="true">↓</span>
        </p>
      </div>
    </section>
  );
}

export function App() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top">
          AXIS <span>/</span> 65
        </a>
        <div className="nav-links">
          <a href="#construction">Construction</a>
          <a href="#specification">Specification</a>
        </div>
        <a className="nav-order" href="#edition">
          First edition <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A tactile instrument for thought</p>
          <h1>
            Built at the
            <br />
            <em>speed</em> of touch.
          </h1>
          <p>
            AXIS 65 is a compact mechanical keyboard milled for deliberate work: low, dense, and
            exact where it matters.
          </p>
          <a className="inline-link" href="#construction">
            Enter the assembly <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-object" aria-label="Assembled AXIS 65 mechanical keyboard">
          <KeyboardShape className="hero-keyboard" type="caps" />
          <div className="hero-measure">
            <span>318 mm</span>
            <i />
          </div>
        </div>
        <div className="hero-note">
          <span>Field unit / 2026</span>
          <b>
            Graphite
            <br />
            anodized
          </b>
        </div>
      </section>

      <section className="manifesto">
        <p>Not a peripheral. A piece of equipment.</p>
        <div>
          <h2>
            A quieter kind of <em>mechanical.</em>
          </h2>
          <p>
            Every surface is specified for the repeated gesture: a milled edge under your palm, a
            switch that returns without drama, mass that keeps the whole object still.
          </p>
        </div>
      </section>

      <ExplodedKeyboard />

      <section className="material-story">
        <div className="material-copy">
          <p>Material / 02</p>
          <h2>
            One billet.
            <br />
            <em>No apology.</em>
          </h2>
          <p>
            The chassis begins as a 7 kg block of 6063 aluminum. It is cut, bead-blasted and
            anodized into a housing that refuses to ring, flex, or leave the desk.
          </p>
        </div>
        <div className="material-block" aria-hidden="true">
          <div className="milled-corner">
            <i />
            <i />
            <i />
          </div>
          <span>6063 AL / GRAPHITE</span>
        </div>
      </section>

      <section className="specification" id="specification">
        <header>
          <p>Specification / 03</p>
          <h2>
            Everything
            <br />
            in its place.
          </h2>
        </header>
        <dl>
          {specifications.map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="edition" id="edition">
        <p>AXIS 65 / First edition</p>
        <h2>
          Made to be
          <br />
          <em>kept close.</em>
        </h2>
        <div>
          <p>Graphite anodized aluminum. Limited to 250 units.</p>
          <a className="edition-link" href="mailto:studio@axis.example">
            Request allocation <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
      <footer>
        <span>© 2026 Axis Instruments</span>
        <span>Toronto / Canada</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
