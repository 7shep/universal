// Pure prompt assembly. No I/O, no subprocess, no clock -- everything here is a
// deterministic function of the generation request, so it is cheap to test and
// safe to reason about.
import type { ProjectGenerationRequest } from '@universal/generation';
import { RAW_PROJECT_SCHEMA_TEXT } from './schema.ts';

export interface CliPrompt {
  system: string;
  user: string;
}

/**
 * Every rule below is enforced later by a machine check, and the check names are
 * quoted so a failure in production can be traced back to the sentence that was
 * supposed to prevent it. `review.ts` owns the first six; `architecture.ts` owns
 * the ARCH_* rules; `validation.ts` owns the file rules.
 */
const HARD_CONSTRAINTS = `## Hard constraints

These are verified by automated checks after you finish. A single violation fails
the whole build, and there is no partial credit.

### Absolutely no network access, and no absolute URLs (check: network-denial)
The source is scanned for \`fetch(\`, \`XMLHttpRequest\`, \`WebSocket\`, \`EventSource\`,
\`navigator.sendBeacon\`, and the literal text \`http://\` or \`https://\`. The URL scan
matches ANYWHERE in the source, including comments, strings, and CSS.
That means: no remote images, no font CDN links, no analytics, no API calls, no
documentation links in comments, no \`xmlns="http://www.w3.org/2000/svg"\` attributes
on inline SVG (omit the attribute; JSX does not need it).
All imagery must be inline SVG or CSS. All type must use system font stacks.

### No prohibited pattern vocabulary (check: prohibited-pattern-resistance)
The source is scanned case-insensitively for these exact words and phrases:
glassmorphism, bento, fake scarcity, gamer neon, black-and-gold, cards inside cards.
This is a plain text match, so a code comment or a CSS class name containing one of
them fails the build. Do not use these words anywhere, and do not build the visual
patterns they name.

### Semantic landmarks (check: semantic-navigation)
The source must contain a \`<nav>\`, a \`<main>\`, and an \`<h1>\`.

### Visible keyboard focus (check: visible-focus)
Some stylesheet must contain a \`:focus-visible\` rule with a genuinely visible
treatment. Never remove focus outlines without replacing them.

### Reduced motion (check: reduced-motion)
Some stylesheet must contain an \`@media (prefers-reduced-motion: reduce)\` block that
neutralises every transition and animation you introduce.

### Route coverage (checks: page-map-coverage, ARCH_ROUTE_PAGE_COVERAGE)
Every approved route string must appear literally in the source AND must map to a
page component that \`src/App.tsx\` imports. The analyser reads App.tsx with the
TypeScript compiler and looks for the route literal next to an identifier imported
from a page module, so use exactly this shape:

\`\`\`tsx
import HomePage from './pages/HomePage';
import FieldNotesPage from './pages/FieldNotesPage';

const ROUTES: Record<string, () => React.ReactElement> = {
  '/': HomePage,
  '/field-notes': FieldNotesPage
};
\`\`\`

There is no router library available. Read \`window.location.pathname\`, look it up in
\`ROUTES\`, fall back to a not-found view, and handle in-app links with an onClick that
calls \`history.pushState\` and updates state. Do not use \`react-router\`; it is not a
dependency and importing it fails the build.

### Architecture (checks: ARCH_*)
- \`src/App.tsx\` holds routing and top-level composition only. It must not contain two
  full page implementations, and it must stay well under roughly 18 JSX elements.
- Every approved route gets its own module under \`src/pages/\`, each rendering a
  \`<main>\` and an \`<h1>\`.
- Shared interface regions named by the plan -- navigation, header, footer -- must be
  their own reusable modules under \`src/components/\`, not repeated per page.
- Every exported or reused component that accepts props must declare an explicit
  TypeScript props type. An untyped props parameter fails the build.
- No JSX subtree of ten or more elements may be duplicated across two components;
  extract a shared component instead.
- Long content collections (six or more entries) belong in a module under \`src/data/\`,
  not inline in a component.
- Split the CSS: \`src/styles.css\` as the entrypoint, plus token, component, and page
  stylesheets that it \`@import\`s.

### Files you may write (check: forbidden_file)
- Only paths under \`src/\`, matching \`^src/[A-Za-z0-9][A-Za-z0-9._/-]*\\.(tsx|ts|css|txt)$\`.
- \`src/App.tsx\` and \`src/styles.css\` are REQUIRED.
- \`src/App.tsx\` must have a default export; the runtime entrypoint does
  \`import App from './App'\`.
- Never emit \`src/main.tsx\`, \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, or
  \`index.html\`. The runtime owns those and emitting one is rejected outright.
- At most 64 files, at most 256 KB per file, at most 2 MB in total.

### It must compile
The build runs \`tsc -b\` with \`strict: true\` and then \`vite build\`. Only \`react\` and
\`react-dom\` (19.2) are installed -- no other runtime dependency exists. Import types
you use, type every prop, and do not leave unused imports.`;

const OUTPUT_CONTRACT = `## Output

Return a single JSON object and nothing else. No prose before or after it, no
markdown fence around it. It must match this schema exactly:

${RAW_PROJECT_SCHEMA_TEXT}

\`kind\` is \`react\` for .tsx, \`typescript\` for .ts, \`stylesheet\` for .css, \`text\` for .txt.`;

const SYSTEM = `You are a senior frontend engineer implementing an approved design plan as a
production React 19 + TypeScript + Vite project.

The plan is a specification, not a suggestion. Implement what it says: its routes, its
page narratives, its typography, its colour roles, its composition and navigation
signatures, its responsive transformations, and its motion strategy. Write real,
specific content drawn from the plan -- never lorem ipsum, never placeholder headings,
never a generic template.

${HARD_CONSTRAINTS}

${OUTPUT_CONTRACT}`;

const list = (values: readonly string[]): string =>
  values.length === 0 ? '(none)' : values.map((value) => `- ${value}`).join('\n');

function renderPages(request: ProjectGenerationRequest): string {
  const narratives = new Map(
    request.context.pageNarratives.map((narrative) => [narrative.pageId, narrative])
  );
  return request.context.pageMap.pages
    .map((page) => {
      const narrative = narratives.get(page.id);
      return [
        `### ${page.name} -- route \`${page.route}\``,
        `- User goal: ${page.userGoal}`,
        `- Primary message: ${page.primaryMessage}`,
        `- Unique responsibility: ${page.uniqueResponsibility}`,
        `- Navigation relationship: ${page.navigationRelationship}`,
        `- Required sections: ${page.requiredSections.join(', ') || '(none)'}`,
        `- Required content: ${page.requiredContent.join(', ') || '(none)'}`,
        ...(page.primaryAction ? [`- Primary action: ${page.primaryAction}`] : []),
        `- Secondary actions: ${page.secondaryActions.join(', ') || '(none)'}`,
        `- Shared elements: ${page.sharedElements.join(', ') || '(none)'}`,
        ...(narrative
          ? [
              `- Narrative role: ${narrative.role}`,
              `- Entry state: ${narrative.entryState}`,
              `- Exit state: ${narrative.exitState}`
            ]
          : [])
      ].join('\n');
    })
    .join('\n\n');
}

export function buildPrompt(request: ProjectGenerationRequest): CliPrompt {
  const { context } = request;
  const user = `# Design plan to implement

Site kind: ${context.pageMap.kind}. Approved routes, in order:
${list(context.pageMap.pages.map((page) => page.route))}

## Pages

${renderPages(request)}

## Typography
- Display: ${context.typography.display}
- Body: ${context.typography.body}
- Scale strategy: ${context.typography.scaleStrategy}
- Roles:
${list(context.typography.roles)}

Both families must be expressed as system font stacks. No webfont may be downloaded.

## Colour
Contrast strategy: ${context.colors.contrastStrategy}
${context.colors.roles.map((role) => `- ${role.role}: ${role.value} -- ${role.usage}`).join('\n')}

Define these as CSS custom properties in a token stylesheet and reference them
everywhere. Do not introduce colours the plan does not name.

## Composition
- Layout family: ${context.composition.layoutFamily}
- Hero strategy: ${context.composition.heroStrategy}
- Grid strategy: ${context.composition.gridStrategy}
- Rhythm: ${context.composition.rhythm}
- Section sequence:
${list(context.composition.sectionSequence)}

## Navigation
- Mode: ${context.navigation.mode}
- Hierarchy: ${context.navigation.hierarchy}
- Desktop behaviour: ${context.navigation.desktopBehavior}
- Mobile behaviour: ${context.navigation.mobileBehavior}
- Relationship to hero: ${context.navigation.relationshipToHero}

## Responsive transformations
${
  context.responsiveTransformations.length === 0
    ? '(none)'
    : context.responsiveTransformations
        .map((item) => `- ${JSON.stringify(item)}`)
        .join('\n')
}

## Motion
${JSON.stringify(context.motion, null, 2)}

Every animation needs a matching \`prefers-reduced-motion: reduce\` override.

## Prohibited patterns
${list(context.prohibitedPatterns)}

## Protected invariants
These must survive implementation intact.
${list(context.protectedInvariants)}

## Implementation constraints
${list(context.implementationConstraints)}

Implement the whole project now and return the JSON object.`;
  return { system: SYSTEM, user };
}

/**
 * The repair pass. It carries the previous attempt verbatim plus the exact gap
 * text the checks produced, because a diagnosis the model can act on is worth
 * more than a second unguided attempt -- and there is only ever one repair.
 */
export function buildRepairPrompt(
  request: ProjectGenerationRequest,
  previousOutput: string,
  gaps: readonly string[]
): CliPrompt {
  const original = buildPrompt(request);
  return {
    system: original.system,
    user: `${original.user}

---

# Repair pass

You already produced the project below. Automated checks rejected it. This is your
only chance to fix it.

## What failed
${list(gaps)}

## Your previous output
${previousOutput}

Fix exactly these failures. Keep everything that already satisfies the plan, do not
restart from scratch, and do not introduce new violations of the hard constraints.
Return the complete corrected JSON object -- every file, not just the changed ones.`
  };
}
