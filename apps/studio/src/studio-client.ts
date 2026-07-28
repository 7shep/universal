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
