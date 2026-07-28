import type {
  CreativeBrief,
  DesignPlanV2 as EngineDesignPlanV2,
  DiscoveryAnswer,
  PageMap
} from '@universal/design-engine';
export type AnswerMode = 'exact' | 'preference' | 'unknown' | 'judgment' | 'draft';
export interface Question {
  id: string;
  label: string;
  prompt: string;
  impact: 'High' | 'Medium';
  mode: AnswerMode;
  answer: string;
}
export interface Group {
  id: string;
  short: string;
  title: string;
  description: string;
  questions: Question[];
}
export interface PageDefinition {
  id: string;
  route: string;
  name: string;
  userGoal: string;
  primaryMessage: string;
  requiredSections: string[];
  contentRequirements: string;
  primaryAction: string;
  secondaryAction: string;
  navigationRelationship: string;
  visualResponsibility: string;
}
export interface BriefDecision {
  id: string;
  category: string;
  title: string;
  value: string;
  rationale?: string;
  provenance: 'user' | 'universal' | 'delegated' | 'unresolved';
}
export interface Direction {
  name: string;
  conceptSpine: string;
  rationale: string;
  visualDecisions: { title: string; detail: string }[];
  risks: string[];
  alternatives: { name: string; summary: string }[];
}
export interface DesignPlanV2 {
  version: string;
  status: string;
  title: string;
  thesis: string;
  conceptSpine: string;
  visualSystem: string;
  interactionPrinciple: string;
  confidence: number;
  tokens: { name: string; value: string; type: 'color' | 'type' | 'space' }[];
  pages: {
    route: string;
    name: string;
    intent: string;
    sections: { name: string; responsibility: string }[];
  }[];
  constraints: string[];
}
export interface StudioProject {
  id: string;
  name: string;
  prompt: string;
  completion: number;
  groups: Group[];
  pages: PageDefinition[];
  brief: BriefDecision[];
  briefApproved: boolean;
  directionApproved: boolean;
  direction?: Direction;
  plan?: DesignPlanV2;
  session?: string;
  workflowTimestamp?: string;
}
export interface ArtDirectorClient {
  startProject(prompt: string): Promise<StudioProject>;
  compileBrief(project: StudioProject): Promise<StudioProject>;
  approveBrief(project: StudioProject): Promise<StudioProject>;
  approveDirection(project: StudioProject): Promise<StudioProject>;
}
const pause = () => new Promise((r) => window.setTimeout(r, 180));
const q = (
  id: string,
  label: string,
  prompt: string,
  impact: Question['impact'],
  mode: AnswerMode,
  answer = ''
): Question => ({ id, label, prompt, impact, mode, answer });
function fixture(prompt: string): StudioProject {
  return {
    id: 'field-notes',
    name: 'Field Notes Society',
    prompt,
    completion: 24,
    brief: [],
    briefApproved: false,
    directionApproved: false,
    groups: [
      {
        id: 'purpose',
        short: 'Purpose',
        title: 'Begin with the human change.',
        description: 'Find the audience, tension, and useful outcome before discussing pages.',
        questions: [
          q(
            'audience',
            'Primary audience',
            'Who needs this most, and what are they moving away from?',
            'High',
            'exact',
            'Designers and writers in cities who feel depleted and want structured time outdoors.'
          ),
          q(
            'outcome',
            'Desired outcome',
            'What should a visitor understand, feel, and do?',
            'High',
            'draft'
          ),
          q(
            'proof',
            'Trust and proof',
            'What evidence makes the offer believable?',
            'Medium',
            'exact',
            'Named guides, past journals, transparent itineraries, and small cohorts.'
          )
        ]
      },
      {
        id: 'structure',
        short: 'Structure',
        title: 'Give every route one job.',
        description: 'Each route needs a distinct goal, message, and visual responsibility.',
        questions: [
          q(
            'conversion',
            'Conversion path',
            'Should the experience build toward membership or application?',
            'High',
            'exact',
            'Build toward a retreat application; newsletter signup is secondary.'
          ),
          q(
            'depth',
            'Editorial depth',
            'How much of the field journal is public?',
            'Medium',
            'judgment'
          )
        ]
      },
      {
        id: 'voice',
        short: 'Voice',
        title: 'Make the first sentence carry weight.',
        description: 'Separate proposition from atmosphere, then define navigation.',
        questions: [
          q(
            'hero',
            'Hero message & copy',
            'What truth should the opening make unavoidable?',
            'High',
            'draft'
          ),
          q(
            'navigation',
            'Navigation presence & items',
            'Should navigation be prominent or quiet and spatial?',
            'Medium',
            'preference',
            'Quiet and spatial. Retreats, Field Journal, Guides, About, Apply.'
          )
        ]
      },
      {
        id: 'visual',
        short: 'Visual world',
        title: 'Define material, not mood.',
        description: 'Give color, type, imagery, assets, and references useful constraints.',
        questions: [
          q(
            'palette',
            'Color palette',
            'Which colors belong—and which feel falsely luxurious?',
            'High',
            'judgment'
          ),
          q(
            'typography',
            'Typography',
            'Should the voice feel archival, contemporary, or practical?',
            'Medium',
            'preference',
            'Contemporary field manual: condensed display sans and readable grotesk.'
          ),
          q(
            'imagery',
            'Imagery',
            'What should photography observe and never perform?',
            'High',
            'exact',
            'Wind, hands, marked maps, shelter, imperfect weather. Never staged summit triumphs.'
          ),
          q(
            'assets',
            'Brand assets',
            'What marks, photography, or artifacts must carry forward?',
            'Medium',
            'unknown'
          ),
          q(
            'references',
            'References & anti-references',
            'Name work with discipline—and patterns to reject.',
            'High',
            'preference',
            'Apartamento intimacy and field-guide indexing. Avoid wellness beige, luxury travel, outdoor-commerce tropes.'
          )
        ]
      }
    ],
    pages: [
      {
        id: 'home',
        route: '/',
        name: 'The Field',
        userGoal: 'Understand the premise and decide whether the next retreat is relevant.',
        primaryMessage: 'Creative attention returns when the conditions around it change.',
        requiredSections: [
          'Opening proposition',
          'Next retreat',
          'Field evidence',
          'Guides',
          'Application'
        ],
        contentRequirements:
          'One promise, retreat facts, journal fragments, guide credentials, cohort expectations.',
        primaryAction: 'Apply for the next field session',
        secondaryAction: 'Read the field journal',
        navigationRelationship: 'Quiet index with perimeter navigation, never a sales bar.',
        visualResponsibility: 'Make landscape feel observed, not advertised.'
      },
      {
        id: 'retreat',
        route: '/retreats/outer-hebrides',
        name: 'Outer Hebrides Field Session',
        userGoal: 'Evaluate the retreat and feel confident applying.',
        primaryMessage: 'Seven days organized around attention, weather, and a small body of work.',
        requiredSections: [
          'Conditions',
          'Daily rhythm',
          'Guide',
          'Place',
          'Practicalities',
          'Application'
        ],
        contentRequirements:
          'Dates, price, accessibility, lodging, travel, schedule, guide, cancellation policy.',
        primaryAction: 'Start an application',
        secondaryAction: 'Ask a practical question',
        navigationRelationship: 'One level beneath the index with a return to all retreats.',
        visualResponsibility: 'Shift from atmosphere to precise, trustworthy logistics.'
      }
    ]
  };
}

function decisions(p: StudioProject): BriefDecision[] {
  const all = p.groups.flatMap((g) => g.questions);
  const make = (id: string, category: string, title: string): BriefDecision => {
    const x = all.find((y) => y.id === id)!;
    if (x.mode === 'unknown')
      return {
        id,
        category,
        title,
        value: 'No usable brand assets have been confirmed.',
        provenance: 'unresolved',
        rationale: 'This may affect mark-making and image sourcing.'
      };
    if (x.mode === 'judgment')
      return {
        id,
        category,
        title,
        value:
          id === 'palette'
            ? 'Charcoal, mineral white, oxidized orange, and weathered blue-grey.'
            : 'Publish complete essays selectively; use annotated fragments elsewhere.',
        provenance: 'delegated',
        rationale: 'Resolved from audience, anti-references, and editorial goal.'
      };
    if (x.mode === 'draft')
      return {
        id,
        category,
        title,
        value:
          id === 'hero'
            ? 'Leave the city. Return with a body of work.'
            : 'Visitors should feel recognized, then examine the next session.',
        provenance: 'universal',
        rationale: 'Drafted from audience, conversion path, and trust signals.'
      };
    return {
      id,
      category,
      title,
      value: x.answer || 'Awaiting detail',
      provenance: x.answer ? 'user' : 'unresolved'
    };
  };
  return [
    make('audience', 'Strategy', 'Primary audience'),
    make('hero', 'Copy', 'Hero message'),
    make('navigation', 'Structure', 'Navigation'),
    make('palette', 'Visual system', 'Color palette'),
    make('typography', 'Visual system', 'Typography'),
    make('imagery', 'Imagery', 'Image direction'),
    make('assets', 'Identity', 'Available brand assets'),
    make('references', 'Taste', 'References and anti-references'),
    make('depth', 'Content', 'Journal depth'),
    make('outcome', 'Strategy', 'Desired outcome')
  ];
}
const direction: Direction = {
  name: 'The Weathered Index',
  conceptSpine:
    'A living field manual: exact enough to trust, unfinished enough to invite participation.',
  rationale:
    'The audience does not need another polished escape fantasy. They need evidence that time away will be thoughtfully held and creatively useful. This pairs an indexed field guide’s authority with intimate traces—notes, crops, weather, and revisions.',
  visualDecisions: [
    {
      title: 'Typography behaves like orientation',
      detail:
        'A condensed sans establishes coordinates; a humane grotesk carries journals and logistics.'
    },
    {
      title: 'Color records weather',
      detail: 'Charcoal and mineral white form the ground. Oxidized orange marks action.'
    },
    {
      title: 'Images are evidence, never escape',
      detail:
        'Close observation, difficult weather, human scale, and physical traces replace travel aspiration.'
    },
    {
      title: 'Navigation frames the field',
      detail: 'A quiet perimeter index keeps location visible and the reading plane clear.'
    }
  ],
  risks: [
    'Editorial restraint may feel quieter than conventional retreat marketing.',
    'The system depends on disciplined photography; generic landscapes will weaken it.',
    'Condensed display type requires strict line-length control on small screens.'
  ],
  alternatives: [
    {
      name: 'Common Ground',
      summary: 'A warmer, people-led direction centered on worktables and shared rituals.'
    },
    {
      name: 'Weather System',
      summary: 'A more experimental direction where forecast notation drives layout and motion.'
    }
  ]
};
function createPlan(p: StudioProject): DesignPlanV2 {
  return {
    version: '2.0',
    status: 'Approved',
    title: `${p.name} — The Weathered Index`,
    thesis:
      'Build trust through editorial precision and evidence, then make application a considered next step.',
    conceptSpine: direction.conceptSpine,
    visualSystem:
      'An asymmetric twelve-column field, near-black planes, rust accents, condensed display type, and documentary crops.',
    interactionPrinciple:
      'Interaction clarifies location, provenance, and state. Motion is brief and removed with reduced motion.',
    confidence: 88,
    tokens: [
      { name: 'Ground / Ink', value: '#171716', type: 'color' },
      { name: 'Text / Mineral', value: '#F4F2EC', type: 'color' },
      { name: 'Signal / Oxide', value: '#D15E3B', type: 'color' },
      { name: 'Display', value: 'Arial Narrow, Aptos Display, sans-serif', type: 'type' },
      { name: 'Body', value: 'Segoe UI, system-ui, sans-serif', type: 'type' },
      { name: 'Section interval', value: 'clamp(5rem, 10vw, 10rem)', type: 'space' }
    ],
    pages: p.pages.map((x) => ({
      route: x.route,
      name: x.name,
      intent: x.userGoal,
      sections: x.requiredSections.map((name, i) => ({
        name,
        responsibility:
          i === 0
            ? x.primaryMessage
            : `Deliver ${name.toLowerCase()} with concrete content and one reading priority.`
      }))
    })),
    constraints: [
      'Meet WCAG AA contrast and preserve visible focus.',
      'Collapse perimeter navigation into a mobile index below 760px.',
      'No live preview or generated React in this phase.',
      'Never encode provenance by color alone.',
      'Render all content immediately with reduced motion.'
    ]
  };
}
interface ArtDirectorSurfaceResponse {
  session: string;
  state: unknown;
  data?: unknown;
}

export interface ArtDirectorMcpTransport {
  startArtDirection(input: {
    prompt: string;
    requestId?: string;
  }): Promise<ArtDirectorSurfaceResponse>;
  getDiscoveryQuestions(session: string): Promise<ArtDirectorSurfaceResponse>;
  submitDiscoveryAnswers(
    session: string,
    input: {
      answers: readonly DiscoveryAnswer[];
      pageMap: PageMap;
      requestId?: string;
    }
  ): Promise<ArtDirectorSurfaceResponse>;
  getCreativeBrief(
    session: string,
    input?: { requestId?: string }
  ): Promise<ArtDirectorSurfaceResponse>;
  approveCreativeBrief(
    session: string,
    input?: { approvedBy?: string; requestId?: string }
  ): Promise<ArtDirectorSurfaceResponse>;
  developArtDirection(
    session: string,
    input?: { requestId?: string }
  ): Promise<ArtDirectorSurfaceResponse>;
  getSelectedDirection(
    session: string,
    input?: { requestId?: string }
  ): Promise<ArtDirectorSurfaceResponse>;
  createDesignPlanV2(
    session: string,
    input?: { requestId?: string }
  ): Promise<ArtDirectorSurfaceResponse>;
}

const TOPIC_BY_QUESTION: Readonly<Record<string, DiscoveryAnswer['topic'] | undefined>> = {
  audience: 'audience',
  outcome: 'emotional-response',
  conversion: 'purpose',
  depth: 'positioning',
  hero: 'hero',
  navigation: 'navigation',
  palette: 'color',
  typography: 'typography',
  imagery: 'imagery',
  assets: 'brand-assets',
  references: 'references'
};

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function requestId(project: StudioProject, operation: string, payload: unknown = {}): string {
  return `${project.id}:${operation}:${stableHash(JSON.stringify([project.session, payload]))}`;
}

function requireSession(project: StudioProject): string {
  if (!project.session)
    throw new Error('This Studio project is not connected to an Art Director session.');
  return project.session;
}

function studioPageMap(project: StudioProject): PageMap {
  return {
    kind: project.pages.length === 1 ? 'single-page' : 'multi-page',
    pages: project.pages.map((page) => ({
      id: page.id,
      route: page.route,
      name: page.name,
      userGoal: page.userGoal,
      primaryMessage: page.primaryMessage,
      requiredSections: page.requiredSections,
      requiredContent: page.contentRequirements
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ...(page.primaryAction ? { primaryAction: page.primaryAction } : {}),
      secondaryActions: page.secondaryAction ? [page.secondaryAction] : [],
      navigationRelationship: page.navigationRelationship,
      uniqueResponsibility: page.visualResponsibility,
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: page.requiredSections
    }))
  };
}

function draftValue(question: Question): string {
  if (question.answer.trim()) return question.answer.trim();
  if (question.id === 'hero') return 'State the approved purpose in one concrete opening promise.';
  if (question.id === 'outcome')
    return 'Visitors should understand the offer, trust it, and take the primary action.';
  return `Resolve ${question.label.toLowerCase()} from the approved brief.`;
}

function discoveryAnswers(project: StudioProject): readonly DiscoveryAnswer[] {
  const now = project.workflowTimestamp ?? '1970-01-01T00:00:00.000Z';
  const answers: DiscoveryAnswer[] = [];
  for (const question of project.groups.flatMap((group) => group.questions)) {
    const topic = TOPIC_BY_QUESTION[question.id];
    if (!topic) continue;
    const mode = question.mode === 'judgment' ? 'use-judgment' : question.mode;
    const summary =
      mode === 'draft'
        ? draftValue(question)
        : question.answer.trim() ||
          (mode === 'use-judgment' ? `Universal may decide ${question.label.toLowerCase()}.` : '');
    if ((mode === 'exact' || mode === 'preference') && !summary)
      throw new Error(`${question.label} needs an answer before the brief can be compiled.`);
    answers.push({
      questionId: `discovery:${topic}`,
      topic,
      mode,
      ...(summary ? { value: { summary } } : {}),
      answeredAt: now
    });
  }
  const pageContent = project.pages
    .flatMap((page) => [page.primaryMessage, page.contentRequirements])
    .filter(Boolean)
    .join(' ');
  if (!pageContent) throw new Error('The page map needs content requirements before brief review.');
  answers.push({
    questionId: 'discovery:page-content',
    topic: 'page-content',
    mode: 'exact',
    value: { summary: pageContent },
    answeredAt: now
  });
  return answers;
}

function provenanceLabel(
  decision: CreativeBrief['decisions'][number]
): BriefDecision['provenance'] {
  if (decision.requiresConfirmation) return 'unresolved';
  if (decision.source === 'user' && ['explicit', 'preferred'].includes(decision.disposition))
    return 'user';
  if (decision.disposition === 'delegated') return 'delegated';
  return 'universal';
}

function briefDecisions(brief: CreativeBrief): BriefDecision[] {
  return brief.decisions.map((decision) => ({
    id: decision.id,
    category: decision.topic,
    title: decision.topic.replaceAll('-', ' '),
    value: decision.value.summary,
    rationale: decision.evidence,
    provenance: provenanceLabel(decision)
  }));
}

function directionFromSurface(data: unknown, concepts: unknown): Direction {
  if (!data || typeof data !== 'object') throw new Error('Selected direction response is missing.');
  const artifact = data as {
    candidate?: Record<string, unknown>;
    candidateId?: string;
    rationale?: string;
  };
  const candidate = artifact.candidate;
  if (
    !candidate ||
    typeof candidate.title !== 'string' ||
    typeof candidate.centralIdea !== 'string'
  )
    throw new Error('Selected direction is malformed.');
  const conceptList =
    concepts &&
    typeof concepts === 'object' &&
    Array.isArray((concepts as { candidates?: unknown }).candidates)
      ? ((concepts as { candidates: Record<string, unknown>[] }).candidates ?? [])
      : [];
  const alternatives = conceptList
    .filter((item) => item.id !== artifact.candidateId)
    .map((item) => ({
      name: String(item.title ?? item.id ?? 'Alternative'),
      summary: String(item.centralIdea ?? 'Alternative direction preserved for comparison.')
    }));
  return {
    name: candidate.title,
    conceptSpine: candidate.centralIdea,
    rationale: String(artifact.rationale ?? 'Selected by policy-owned concept evaluation.'),
    visualDecisions: [
      {
        title: 'Composition',
        detail: String(candidate.composition ?? 'Defined by the selected concept.')
      },
      {
        title: 'Typography',
        detail: String(candidate.typographyIntent ?? 'Purposeful type roles.')
      },
      { title: 'Imagery', detail: String(candidate.imageryIntent ?? 'Evidence-led imagery.') },
      {
        title: 'Navigation',
        detail: String(candidate.navigationPhilosophy ?? 'Predictable orientation.')
      }
    ],
    risks: Array.isArray(candidate.risks)
      ? candidate.risks.map(String)
      : ['Validate the direction in implementation.'],
    alternatives
  };
}

function planFromSurface(project: StudioProject, data: unknown): DesignPlanV2 {
  if (!data || typeof data !== 'object' || !('plan' in data))
    throw new Error('Design Plan v2 response is missing.');
  const plan = (data as { plan: EngineDesignPlanV2 }).plan;
  return {
    version: plan.contractVersion,
    status: 'Approved',
    title: `${project.name} — ${plan.conceptSpine.value}`,
    thesis: plan.conceptSpine.rationale,
    conceptSpine: plan.conceptSpine.value,
    visualSystem: `${plan.compositionSignature.value.layoutFamily}; ${plan.typographySystem.value.scaleStrategy}`,
    interactionPrinciple: plan.motionStrategy.value.principles.join(' '),
    confidence: 100,
    tokens: [
      ...plan.colorSystem.value.roles.map((role) => ({
        name: role.role,
        value: role.value,
        type: 'color' as const
      })),
      { name: 'Display', value: plan.typographySystem.value.display, type: 'type' as const },
      { name: 'Body', value: plan.typographySystem.value.body, type: 'type' as const }
    ],
    pages: plan.pageMap.pages.map((page) => ({
      route: page.route,
      name: page.name,
      intent: page.userGoal,
      sections: plan.sectionIntentions
        .filter((section) => section.pageId === page.id)
        .map((section) => ({ name: section.requiredSection, responsibility: section.intention }))
    })),
    constraints: [
      ...plan.prohibitedPatterns.value,
      ...plan.protectedInvariants.map((invariant) => invariant.statement),
      plan.motionStrategy.value.reducedMotion
    ]
  };
}

export function createMcpArtDirectorClient(transport: ArtDirectorMcpTransport): ArtDirectorClient {
  return {
    async startProject(prompt) {
      const started = await transport.startArtDirection({
        prompt,
        requestId: `studio:start:${prompt
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 48)}`
      });
      await transport.getDiscoveryQuestions(started.session);
      const state = started.state as { id?: string; createdAt?: string };
      return {
        ...fixture(prompt),
        id: String(state.id ?? 'studio-project'),
        session: started.session,
        workflowTimestamp: state.createdAt ?? '1970-01-01T00:00:00.000Z'
      };
    },
    async compileBrief(project) {
      const answers = discoveryAnswers(project);
      const pageMap = studioPageMap(project);
      const submitted = await transport.submitDiscoveryAnswers(requireSession(project), {
        answers,
        pageMap,
        requestId: requestId(project, 'discovery', { answers, pageMap })
      });
      const compiled = await transport.getCreativeBrief(submitted.session, {
        requestId: requestId(project, 'brief', submitted.session)
      });
      const brief = compiled.data as CreativeBrief;
      return {
        ...project,
        session: compiled.session,
        brief: briefDecisions(brief),
        completion: 56
      };
    },
    async approveBrief(project) {
      const approved = await transport.approveCreativeBrief(requireSession(project), {
        approvedBy: 'studio-user',
        requestId: requestId(project, 'approve-brief')
      });
      const developed = await transport.developArtDirection(approved.session, {
        requestId: requestId(project, 'develop-concepts')
      });
      const selected = await transport.getSelectedDirection(developed.session, {
        requestId: requestId(project, 'select-direction')
      });
      return {
        ...project,
        session: selected.session,
        briefApproved: true,
        completion: 76,
        direction: directionFromSurface(selected.data, developed.data)
      };
    },
    async approveDirection(project) {
      const planned = await transport.createDesignPlanV2(requireSession(project), {
        requestId: requestId(project, 'create-plan')
      });
      return {
        ...project,
        session: planned.session,
        directionApproved: true,
        completion: 100,
        plan: planFromSurface(project, planned.data)
      };
    }
  };
}
class LocalArtDirectorClient implements ArtDirectorClient {
  async startProject(prompt: string) {
    await pause();
    return fixture(prompt);
  }
  async compileBrief(p: StudioProject) {
    await pause();
    return { ...p, brief: decisions(p), completion: 56 };
  }
  async approveBrief(p: StudioProject) {
    await pause();
    return { ...p, briefApproved: true, completion: 76, direction };
  }
  async approveDirection(p: StudioProject) {
    await pause();
    return { ...p, directionApproved: true, completion: 100, plan: createPlan(p) };
  }
}
export const createLocalArtDirectorClient = (): ArtDirectorClient => new LocalArtDirectorClient();
