import { useEffect, useRef, useState } from 'react';

const links = {
  projects: 'https://qmind.ca/projects',
  paper: 'https://qmind.ca/Virtual_Assistant.pdf',
  leadership: 'https://qmind.ca/leadership',
  review: 'https://medium.com/qmind-ai',
  discord: 'https://discord.gg/Hj6SMEZHBp',
  instagram: 'https://www.instagram.com/qmind.ai/',
  linkedIn: 'https://ca.linkedin.com/school/qmindai/',
  story: 'https://www.queensu.ca/alumni/supporting-queens/stories-of-impact/qmind',
  cucai: 'https://cucai.ca/',
  proceedings: 'https://cucai.ca/2025_proceedings.pdf',
};

const projects = [
  {
    title: 'Virtual Assistant Attention Detection',
    area: 'Computer vision / HCI',
    description: 'A novel attention-detection system designed to make interaction with virtual assistant devices feel more natural.',
    output: 'Research paper, attention classifier, and web application',
    image: '/qmind/project-virtual.jpg',
    alt: 'Virtual Assistant Attention Detection project output',
    href: links.paper,
    action: 'Read the paper',
  },
  {
    title: 'Quantum Generative Adversarial Networks',
    area: 'Quantum computing',
    description: 'A featured QMIND design team project exploring generative adversarial networks in a quantum computing context.',
    output: 'Design team project',
    image: '/qmind/event-2.jpg',
    alt: 'QMIND students presenting technical work',
    href: links.projects,
    action: 'Open project index',
  },
  {
    title: 'Android Waste Classification',
    area: 'Computer vision',
    description: 'A featured design team project applying image classification to the real-world problem of identifying waste.',
    output: 'Applied classification project',
    image: '/qmind/event-1.jpg',
    alt: 'QMIND student project showcase',
    href: links.projects,
    action: 'Open project index',
  },
  {
    title: 'Predictive Diabetic Risk Modelling',
    area: 'Healthcare',
    description: 'A featured QMIND project focused on predictive modelling in a healthcare setting.',
    output: 'Applied healthcare project',
    image: '/qmind/event-3.jpg',
    alt: 'Students discussing QMIND project work',
    href: links.projects,
    action: 'Open project index',
  },
];

const research = [
  ['RL²', 'Reinforcement learning', 'An AI agent learns ball control, shooting, and dribbling in Rocket League using deep reinforcement learning.'],
  ['EEG', 'Innovation / healthcare', 'Two attention-based neural networks explore more accessible classification from noisy, eight-channel EEG data.'],
  ['Generative Music AI\'s $350 Million Problem', 'AI ethics', 'A privacy-preserving framework for tracking copyrighted music and compensating creators in generative AI systems.'],
  ['Ethical Implications of MRI AI', 'AI ethics / healthcare', 'A framework for policymakers and clinicians evaluating privacy, security, and responsible clinical use.'],
  ['American Sign Language Recognition', 'Computer vision / AI ethics', 'Video-classification models power an educational interface designed to support more inclusive ASL learning.'],
];

const stats: Array<[number, string, string]> = [
  [230, '+', 'AI developers join each year'],
  [200, '+', 'Lifetime AI papers and projects'],
  [340, '+', 'Delegates at CUCAI each year'],
  [30, '+', 'Industry clients'],
  [70, '+', 'AI articles published'],
  [20, '', 'Projects in 2026'],
  [2600, '+', 'Hours read on Medium'],
];

const members = [
  ['Daniel Wang', 'Business Program Manager', 'Microsoft', 'https://qmind.ca/_next/static/media/Daniel_Wang.0b74049b.png'],
  ['Rabab Azeem', 'Software Developer', 'Amazon', 'https://qmind.ca/_next/static/media/Rabab_Azeem.bc86423c.png'],
  ['Kevin Yu', 'Software Developer', 'PwC', 'https://qmind.ca/_next/static/media/Kevin_Yu.151a88a7.png'],
  ['Marcelo Chaman Mallqui', 'AI Systems Engineer', 'Recalc', 'https://qmind.ca/_next/static/media/Marcelo_M.ba90a36a.png'],
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const format = (number: number) => `${new Intl.NumberFormat('en-CA').format(number)}${suffix}`;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = format(value);
      return;
    }

    let frame = 0;
    let started = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 1450, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        element.textContent = format(Math.round(value * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.35 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [suffix, value]);

  return <span ref={ref}>0{suffix}</span>;
}

function ExternalLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function Masthead() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [open]);

  return <>
    <header className="masthead">
      <a className="brand" href="#top" aria-label="QMIND home">
        <img src="/qmind/qmind-logo.svg" alt="QMIND" />
        <span>Queen's AI Hub</span>
      </a>
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <nav className="desktop-nav" aria-label="Primary navigation">
        <a href="#projects">Projects</a>
        <a href="#research">Research</a>
        <a href="#about">About</a>
        <a href="#community">Community</a>
      </nav>
    </header>
    <div className={`site-menu ${open ? 'is-open' : ''}`} id="site-menu" aria-hidden={!open}>
      <nav aria-label="Mobile navigation">
        <a href="#projects" onClick={() => setOpen(false)}>Projects</a>
        <a href="#research" onClick={() => setOpen(false)}>Research</a>
        <a href="#about" onClick={() => setOpen(false)}>What is QMIND?</a>
        <a href="#community" onClick={() => setOpen(false)}>Community</a>
        <a href="#partners" onClick={() => setOpen(false)}>Partners</a>
      </nav>
      <ExternalLink href={links.discord}>Join the community <Arrow /></ExternalLink>
    </div>
  </>;
}

function UtilityDock() {
  return <nav className="utility-dock" aria-label="Quick links">
    <a href="#projects">Explore projects</a>
    <ExternalLink href={links.review}>Tech Review</ExternalLink>
    <ExternalLink href="mailto:partnerships@qmind.ca">Work with us</ExternalLink>
  </nav>;
}

function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <p className="hero-kicker">Student-led AI research and applied projects</p>
    <h1 id="hero-title">Serious AI work.<br />Built by students.</h1>
    <p className="hero-copy">Interdisciplinary teams build, research, and publish AI systems with real-world relevance.</p>
    <figure className="hero-media">
      <img src="/qmind/project-virtual.jpg" alt="Output from QMIND's Virtual Assistant Attention Detection project" width="1200" height="900" />
      <figcaption>Virtual Assistant Attention Detection</figcaption>
    </figure>
    <div className="hero-proof"><strong>Canada's largest</strong><span>undergraduate AI organization</span></div>
    <div className="hero-team"><strong>4-6</strong><span>students per project team</span></div>
  </section>;
}

function Projects() {
  const [active, setActive] = useState(0);
  const project = projects[active];

  return <section className="projects section" id="projects" aria-labelledby="projects-title">
    <header className="projects-heading">
      <h2 id="projects-title">Work is the proof.</h2>
      <p>Design teams of 4-6 students tackle real-world problems, from attention-aware interfaces to healthcare and quantum computing.</p>
    </header>
    <div className="project-explorer">
      <div className="project-index" role="list" aria-label="Selected projects">
        {projects.map((item, index) => <button
          type="button"
          role="listitem"
          className={index === active ? 'is-active' : ''}
          aria-pressed={index === active}
          onClick={() => setActive(index)}
          onFocus={() => setActive(index)}
          onMouseEnter={() => setActive(index)}
          key={item.title}
        >
          <span>{item.area}</span>
          <strong>{item.title}</strong>
          <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
        </button>)}
      </div>
      <article className="project-evidence" aria-live="polite">
        <img key={project.image} src={project.image} alt={project.alt} width="1200" height="900" />
        <div className="evidence-copy">
          <p>{project.output}</p>
          <h3>{project.title}</h3>
          <p>{project.description}</p>
          <ExternalLink href={project.href}>{project.action} <Arrow /></ExternalLink>
        </div>
      </article>
    </div>
    <ExternalLink className="section-link" href={links.projects}>View all projects <Arrow /></ExternalLink>
  </section>;
}

function Research() {
  return <section className="research section" id="research" aria-labelledby="research-title">
    <div className="research-intro">
      <h2 id="research-title">Research leaves a record.</h2>
      <p>QMIND members produce papers, project documentation, and articles across applied AI and its ethical questions.</p>
      <div className="research-actions">
        <ExternalLink href={links.review}>Open Tech Review <Arrow /></ExternalLink>
        <ExternalLink href={links.paper}>Read a research paper <Arrow /></ExternalLink>
      </div>
    </div>
    <ol className="research-index">
      {research.map(([title, area, description]) => <li key={title}>
        <div><span>{area}</span><h3>{title}</h3></div>
        <p>{description}</p>
        <ExternalLink href={links.projects} aria-label={`View ${title} in the QMIND project index`}><Arrow /></ExternalLink>
      </li>)}
    </ol>
    <div className="publication-proof">
      <p><strong><Counter value={70} suffix="+" /></strong> AI articles published</p>
      <p><strong><Counter value={2600} suffix="+" /></strong> hours read on Medium</p>
      <p><strong><Counter value={200} suffix="+" /></strong> lifetime AI papers and projects</p>
    </div>
  </section>;
}

function About() {
  return <section className="about section" id="about" aria-labelledby="about-title">
    <div className="about-statement">
      <h2 id="about-title">What is QMIND?</h2>
      <p>QMIND is Canada's largest undergraduate organization on AI. Each year, it leads 250+ students in teams of 4-6 through research and consulting projects that solve real-world problems for industry clients.</p>
      <p>Students build, research, and explore artificial intelligence, machine learning, blockchain, and quantum computing across AI ethics, computer vision, HCI, healthcare, NLP, and reinforcement learning.</p>
    </div>
    <dl className="stat-field">
      {stats.map(([number, suffix, label]) => <div key={label}><dt><Counter value={number} suffix={suffix} /></dt><dd>{label}</dd></div>)}
    </dl>
    <aside className="discipline-field" aria-label="Areas of work">
      {['AI research', 'AI ethics', 'Computer vision', 'Human-computer interaction', 'Healthcare', 'Natural language processing', 'Reinforcement learning', 'Consulting projects'].map(item => <span key={item}>{item}</span>)}
    </aside>
  </section>;
}

function Events() {
  const events = [
    ['Kaz Nejatian', 'Shopify COO & VP Product', '160 attendees', '/qmind/event-1.jpg'],
    ["InQUbate's Product Leaders Panel", 'With Smith Digital Product Management Master Program', '80 attendees', '/qmind/event-2.jpg'],
    ['QMIND Connect', 'Monthly town hall', '80 attendees', '/qmind/event-3.jpg'],
  ];
  return <section className="events section" id="community" aria-labelledby="events-title">
    <h2 id="events-title">Ideas meet the room.</h2>
    <div className="event-composition">
      {events.map(([title, detail, attendance, image], index) => <article className={`event event-${index + 1}`} key={title}>
        <img src={image} alt={`${title} at a QMIND event`} width="980" height="754" />
        <div><p>{attendance}</p><h3>{title}</h3><span>{detail}</span></div>
      </article>)}
    </div>
  </section>;
}

function Outcomes() {
  return <section className="outcomes section" aria-labelledby="outcomes-title">
    <div className="quote-panel">
      <p className="quote">“QMIND is a place where you can expect to be intellectually stimulated every day. Some of the best opportunities I have been given in my undergrad were snowballed from QMIND.”</p>
      <div className="quote-person">
        <img src="https://qmind.ca/_next/static/media/Olivia_Xu.1423f88d.png" alt="Olivia Xu" width="320" height="320" />
        <p><strong>Olivia Xu</strong><span>Computer Science '24</span><span>Software Engineer at Uber</span></p>
      </div>
    </div>
    <div className="member-field">
      <h2 id="outcomes-title">Members carry the work forward.</h2>
      <div className="member-list">
        {members.map(([name, role, company, image]) => <article key={name}>
          <img src={image} alt={name} width="240" height="240" />
          <p><strong>{name}</strong><span>{role}</span><span>{company}</span></p>
        </article>)}
      </div>
      <div className="employer-field" aria-label="Alumni employers">
        {['Uber', 'Microsoft', 'Amazon', 'PwC', 'Recalc', 'RedBit'].map(company => <span key={company}>{company}</span>)}
      </div>
    </div>
  </section>;
}

function Partners() {
  const sponsors = [
    ['Deloitte', '/qmind/deloitte.png', 'Diamond'],
    ["Smith Engineering, Queen's University", '/qmind/smith-engineering.png', 'Diamond'],
    ['University of Toronto Master of Science in Applied Computing', '/qmind/uoft-mscac.png', 'Silver'],
    ['COMPSA', '/qmind/compsa.png', 'Silver'],
    ["AMS Queen's University", '/qmind/ams.png', 'Bronze'],
  ];
  return <section className="partners section" id="partners" aria-labelledby="partners-title">
    <h2 id="partners-title">Backed by partners who value student work.</h2>
    <div className="sponsor-tiers">
      {['Diamond', 'Silver', 'Bronze'].map(tier => <div key={tier}>
        <h3>{tier} tier</h3>
        <div>{sponsors.filter(item => item[2] === tier).map(([name, src]) => <img key={name} src={src} alt={name} />)}</div>
      </div>)}
    </div>
    <ExternalLink className="section-link" href="mailto:partnerships@qmind.ca">Partner with QMIND <Arrow /></ExternalLink>
  </section>;
}

function Programs() {
  return <section className="programs section" aria-label="QMIND programs">
    <article className="program-cucai">
      <img src="/qmind/conference.png" alt="Delegates at the Canadian Undergraduate Conference on Artificial Intelligence" width="1290" height="413" />
      <div><p>National conference</p><h2>CUCAI</h2><p>QMIND hosts Canada's largest AI conference. CUCAI 2025 welcomed 340+ delegates.</p><ExternalLink href={links.cucai}>Visit CUCAI <Arrow /></ExternalLink><ExternalLink href={links.proceedings}>Read proceedings <Arrow /></ExternalLink></div>
    </article>
    <article className="program-inqubate">
      <div><p>Product incubator</p><h2>InQUbate</h2><p>QMIND incubates startups from the ground up. InQUbate partnered with AWS Activate in 2022-2023.</p><ExternalLink href="https://www.instagram.com/qmind.ai/">Learn more <Arrow /></ExternalLink></div>
      <img src="https://qmind.ca/_next/static/media/aws_mobile.175140d1.png" alt="InQUbate and AWS Activate program artwork" width="900" height="900" />
    </article>
  </section>;
}

function Closing() {
  return <section className="closing section" aria-labelledby="closing-title">
    <h2 id="closing-title">Find your place in the work.</h2>
    <div className="closing-links">
      <ExternalLink href={links.projects}>Explore projects <Arrow /></ExternalLink>
      <ExternalLink href={links.discord}>Join the community <Arrow /></ExternalLink>
      <ExternalLink href="mailto:partnerships@qmind.ca">Work with QMIND <Arrow /></ExternalLink>
      <ExternalLink href={links.review}>Follow the research <Arrow /></ExternalLink>
    </div>
  </section>;
}

function Footer() {
  return <footer>
    <a className="footer-brand" href="#top"><img src="/qmind/qmind-logo.svg" alt="QMIND" /></a>
    <nav aria-label="QMIND site links">
      <a href="#top">Home</a>
      <ExternalLink href={links.leadership}>Leadership</ExternalLink>
      <ExternalLink href={links.projects}>Projects</ExternalLink>
      <ExternalLink href={links.review}>QMIND Tech Review</ExternalLink>
      <ExternalLink href={links.story}>Queen's story</ExternalLink>
      <ExternalLink href={links.cucai}>CUCAI</ExternalLink>
    </nav>
    <nav aria-label="QMIND social links">
      <ExternalLink href={links.instagram}>Instagram</ExternalLink>
      <ExternalLink href={links.discord}>Discord</ExternalLink>
      <ExternalLink href={links.linkedIn}>LinkedIn</ExternalLink>
    </nav>
    <p>Queen's AI Hub<br />Kingston, Ontario, Canada</p>
    <small>© {new Date().getFullYear()} QMIND</small>
  </footer>;
}

export function App() {
  return <main>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Masthead />
    <UtilityDock />
    <div id="main-content">
      <Hero />
      <Projects />
      <Research />
      <About />
      <Events />
      <Outcomes />
      <Partners />
      <Programs />
      <Closing />
    </div>
    <Footer />
  </main>;
}
