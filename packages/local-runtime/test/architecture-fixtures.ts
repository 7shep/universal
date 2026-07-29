import type {
  GeneratedProject,
  ProjectFile,
  ProjectGenerationRequest
} from '@universal/generation';
import type { PageMap } from '@universal/design-engine';

const file = (path: string, content: string): ProjectFile => ({
  path,
  content,
  kind: path.endsWith('.css') ? 'stylesheet' : path.endsWith('.tsx') ? 'react' : 'typescript',
  digest: 'a'.repeat(64)
});

export const multiPageMap: PageMap = {
  kind: 'multi-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Learn',
      primaryMessage: 'Home',
      requiredSections: ['hero', 'record'],
      requiredContent: ['intro'],
      secondaryActions: [],
      navigationRelationship: 'primary',
      uniqueResponsibility: 'Introduction',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['hero']
    },
    {
      id: 'expedition',
      route: '/expedition',
      name: 'Expedition',
      userGoal: 'Explore',
      primaryMessage: 'Expedition',
      requiredSections: ['overview', 'log'],
      requiredContent: ['details'],
      secondaryActions: [],
      navigationRelationship: 'primary',
      uniqueResponsibility: 'Expedition detail',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['log']
    },
    {
      id: 'notes',
      route: '/field-notes',
      name: 'Field notes',
      userGoal: 'Read',
      primaryMessage: 'Notes',
      requiredSections: ['index', 'archive'],
      requiredContent: ['notes'],
      secondaryActions: [],
      navigationRelationship: 'primary',
      uniqueResponsibility: 'Notes archive',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['archive']
    }
  ]
};

export const singlePageMap = (sections: readonly string[]): PageMap => ({
  kind: 'single-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Learn',
      primaryMessage: 'Home',
      requiredSections: sections,
      requiredContent: [],
      secondaryActions: [],
      navigationRelationship: 'only route',
      uniqueResponsibility: 'Home',
      sharedElements: [],
      pageSpecificElements: sections
    }
  ]
});

export function requestWithPageMap(
  base: ProjectGenerationRequest,
  pageMap: PageMap
): ProjectGenerationRequest {
  return {
    ...base,
    designPlan: { ...base.designPlan, pageMap },
    context: { ...base.context, pageMap }
  };
}

export function project(files: Readonly<Record<string, string>>): GeneratedProject {
  return {
    contractVersion: '1.0.0',
    projectId: 'project:architecture',
    revisionId: 'revision:architecture:1',
    requestDigest: 'b'.repeat(64),
    framework: 'react-vite',
    entrypoint: 'src/main.tsx',
    files: Object.entries(files).map(([path, content]) => file(path, content)),
    assets: [],
    diagnostics: []
  };
}

export const organizedFiles: Readonly<Record<string, string>> = {
  'src/App.tsx': `import { SiteHeader } from './components/SiteHeader'; import { SiteFooter } from './components/SiteFooter'; import { HomePage } from './pages/HomePage'; import { ExpeditionPage } from './pages/ExpeditionPage'; import { FieldNotesPage } from './pages/FieldNotesPage'; const pages = { '/': HomePage, '/expedition': ExpeditionPage, '/field-notes': FieldNotesPage }; export default function App(){ const Page = pages[window.location.pathname as keyof typeof pages] ?? HomePage; return <><SiteHeader activePath={window.location.pathname}/><Page/><SiteFooter/></>; }`,
  'src/components/SiteHeader.tsx': `interface SiteHeaderProps { activePath: string } export function SiteHeader({ activePath }: SiteHeaderProps){ return <header><strong>North</strong><nav aria-label="Primary"><a aria-current={activePath === '/' ? 'page' : undefined} href="/">Home</a><a href="/expedition">Expedition</a><a href="/field-notes">Notes</a></nav></header>; }`,
  'src/components/SiteFooter.tsx': `export function SiteFooter(){ return <footer><strong>North</strong><p>Field office</p></footer>; }`,
  'src/pages/HomePage.tsx': `export function HomePage(){ return <main><p>Welcome</p><h1>Home</h1><section><h2>Record</h2><p>Introduction</p></section></main>; }`,
  'src/pages/ExpeditionPage.tsx': `export function ExpeditionPage(){ return <main><p>North</p><h1>Expedition</h1><article><h2>Log</h2><p>Details</p></article></main>; }`,
  'src/pages/FieldNotesPage.tsx': `export function FieldNotesPage(){ return <main><p>Archive</p><h1>Field notes</h1><ol><li>Ice</li><li>Stone</li></ol></main>; }`,
  'src/styles.css': `@import './styles/components.css'; :focus-visible{outline:2px solid} @media(prefers-reduced-motion:reduce){*{transition:none}}`,
  'src/styles/components.css': `header,footer{display:flex;justify-content:space-between} main{min-height:80vh}`
};
