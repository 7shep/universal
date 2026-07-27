import type { CollectSourceEvidenceInput, RenderedEvidenceReference } from '../src/evidence.ts';

export const representativeSourceFiles = [
  {
    path: 'src/App.tsx',
    content: `<main>
  <header><nav aria-label="Primary">Index</nav></header>
  <section aria-labelledby="title">
    <h1 id="title">Field Notes</h1>
    <img src="/field-notes.webp" alt="Annotated field notebook" />
    <button type="button">Explore issue</button>
  </section>
</main>
`
  },
  {
    path: 'src/styles.css',
    content: `:root {
  --paper: #f2efe7;
  --ink: #1d1d1a;
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms; }
}
`
  }
] as const;

export const sourceEvidencePolicy = {
  include: ['package.json', 'src/**/*.css', 'src/**/*.tsx'],
  ignore: ['dist/**', '*.log'],
  requiredChecks: ['build', 'static_contract']
} as const;

export const completedEvidenceChecks = ['build', 'static_contract'] as const;

export const sourceOnlyEvidenceInput: CollectSourceEvidenceInput = {
  files: representativeSourceFiles,
  policy: sourceEvidencePolicy,
  completedChecks: completedEvidenceChecks
};

export const renderedEvidenceReferences = [
  {
    path: 'renders/desktop.png',
    viewport: '1440x900',
    sha256: 'A'.repeat(64)
  },
  {
    path: 'renders/mobile.png',
    viewport: '390x844',
    sha256: 'B'.repeat(64)
  }
] as const satisfies readonly RenderedEvidenceReference[];
