import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { StudioApp } from './studio-app';
import type {
  ArtDirectorClient,
  BriefDecision,
  DesignPlanV2,
  Direction,
  Group,
  StudioProject
} from './studio-client';
import type { GenerationLifecycleClient, GenerationSnapshot } from './runtime-client';

afterEach(cleanup);

const VALID_PROMPT =
  'A membership site for a small collective that runs guided creative retreats in overlooked coastal towns.';

const groups: Group[] = [
  {
    id: 'intent',
    short: 'Intent',
    title: 'What is this for?',
    description: 'Establish the purpose before anything visual.',
    questions: [
      {
        id: 'audience',
        label: 'Primary audience',
        prompt: 'Who must this convince first?',
        impact: 'High',
        mode: 'exact',
        answer: ''
      }
    ]
  },
  {
    id: 'structure',
    short: 'Structure',
    title: 'What must exist?',
    description: 'Define what every route must accomplish.',
    questions: [
      {
        id: 'tone',
        label: 'Tone',
        prompt: 'How should this feel?',
        impact: 'Medium',
        mode: 'exact',
        answer: ''
      }
    ]
  }
];

const brief: BriefDecision[] = [
  {
    id: 'd1',
    category: 'Audience',
    title: 'Primary audience',
    value: 'Returning retreat members.',
    provenance: 'user'
  },
  {
    id: 'd2',
    category: 'Typography',
    title: 'Typeface pairing',
    value: 'A humanist serif against a narrow grotesque.',
    rationale: 'Carries editorial weight without nostalgia.',
    provenance: 'universal'
  },
  {
    id: 'd3',
    category: 'Motion',
    title: 'Motion budget',
    value: 'Universal will decide and explain this.',
    provenance: 'delegated'
  },
  {
    id: 'd4',
    category: 'Commerce',
    title: 'Membership pricing',
    value: 'Not yet decided.',
    provenance: 'unresolved'
  }
];

const direction: Direction = {
  name: 'Tidal Ledger',
  conceptSpine: 'A record kept at the waterline.',
  rationale: 'The collective documents places rather than selling them.',
  visualDecisions: [
    { title: 'Asymmetric field', detail: 'A twelve-column grid broken deliberately.' }
  ],
  risks: ['Density can read as austere at small sizes.'],
  alternatives: [{ name: 'Quiet Almanac', summary: 'Calmer, more classical, less specific.' }]
};

const plan: DesignPlanV2 = {
  version: '2.0.0',
  status: 'Approved',
  title: 'Tidal Ledger design plan',
  thesis: 'Document the coast; do not advertise it.',
  conceptSpine: direction.conceptSpine,
  visualSystem: 'Near-black planes, rust accents, condensed display type.',
  interactionPrinciple: 'Reveal detail on intent, never on hover alone.',
  confidence: 82,
  tokens: [{ name: 'ink', value: '#111111', type: 'color' }],
  pages: [
    {
      route: '/',
      name: 'Home',
      intent: 'Establish the collective and the current season.',
      sections: [{ name: 'Masthead', responsibility: 'Locate the reader in place and season.' }]
    }
  ],
  constraints: ['Meet WCAG 2.2 AA contrast for all text.']
};

const baseProject: StudioProject = {
  id: 'field-notes',
  name: 'Field Notes Society',
  prompt: VALID_PROMPT,
  completion: 24,
  groups,
  pages: [],
  brief: [],
  briefApproved: false,
  directionApproved: false
};

/**
 * Deterministic in-memory ArtDirectorClient. No network, stdio, or model
 * provider is involved; each call returns the next project snapshot directly.
 */
class FakeArtDirectorClient implements ArtDirectorClient {
  readonly calls: string[] = [];
  private failStartTimes: number;

  constructor(options: { failStartTimes?: number } = {}) {
    this.failStartTimes = options.failStartTimes ?? 0;
  }

  async startProject(prompt: string): Promise<StudioProject> {
    this.calls.push('startProject');
    if (this.failStartTimes > 0) {
      this.failStartTimes -= 1;
      throw new Error('The art director session could not be reached.');
    }
    return { ...baseProject, prompt };
  }

  async compileBrief(project: StudioProject): Promise<StudioProject> {
    this.calls.push('compileBrief');
    return { ...project, brief, completion: 68 };
  }

  async approveBrief(project: StudioProject): Promise<StudioProject> {
    this.calls.push('approveBrief');
    return { ...project, briefApproved: true, direction, completion: 84 };
  }

  async approveDirection(project: StudioProject): Promise<StudioProject> {
    this.calls.push('approveDirection');
    return { ...project, directionApproved: true, plan, completion: 100 };
  }
}

/** Keeps the Plan stage inert so these tests stay scoped to art direction. */
const idleSnapshot = (): GenerationSnapshot => ({
  status: 'idle',
  cancellable: false,
  retryable: false,
  diagnostics: []
});
const idleGenerationClient: GenerationLifecycleClient = {
  load: async () => idleSnapshot(),
  start: async () => idleSnapshot(),
  cancel: async () => idleSnapshot()
};

function renderStudio(client: ArtDirectorClient) {
  return render(<StudioApp client={client} generationClient={idleGenerationClient} />);
}

const promptField = () => screen.getByLabelText('What are you making?') as HTMLTextAreaElement;
const button = (name: RegExp | string) => screen.getByRole('button', { name });

/** Walks the four stages so later stages can be tested from a real transition. */
async function reachStage(
  client: ArtDirectorClient,
  stage: 'discovery' | 'brief' | 'direction' | 'plan'
) {
  renderStudio(client);
  fireEvent.change(promptField(), { target: { value: VALID_PROMPT } });
  fireEvent.click(button(/Begin discovery/));
  await screen.findByRole('heading', { name: groups[0]!.title });
  if (stage === 'discovery') return;

  fireEvent.click(button(/Next question group/));
  fireEvent.click(button(/Review the brief/));
  await screen.findByRole('heading', { name: 'One brief. Clear authorship.' });
  if (stage === 'brief') return;

  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(button(/Approve brief/));
  await screen.findByRole('heading', { name: direction.name });
  if (stage === 'direction') return;

  fireEvent.click(button(/Approve direction/));
  await screen.findByRole('heading', { name: plan.title });
}

describe('stage 1: prompt submission and validation', () => {
  test('blocks submission and explains why while the prompt is too short', () => {
    renderStudio(new FakeArtDirectorClient());
    const field = promptField();

    fireEvent.change(field, { target: { value: 'a shop' } });
    fireEvent.blur(field);

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(button(/Begin discovery/)).toHaveProperty('disabled', true);
    const guidance = screen.getByRole('alert');
    expect(guidance.textContent).toMatch(/more characters/);
    expect(field.getAttribute('aria-describedby')).toContain(guidance.id);
  });

  test('reports an empty prompt as a missing decision rather than a length problem', () => {
    renderStudio(new FakeArtDirectorClient());
    const field = promptField();

    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);

    expect(screen.getByRole('alert').textContent).toBe('Describe what you want to make.');
  });

  test('starts discovery from a valid prompt and shows a loading label while it runs', async () => {
    const client = new FakeArtDirectorClient();
    renderStudio(client);

    fireEvent.change(promptField(), { target: { value: VALID_PROMPT } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(button(/Begin discovery/));

    expect(screen.getByRole('button', { name: /Preparing discovery/ })).toHaveProperty(
      'disabled',
      true
    );
    await screen.findByRole('heading', { name: groups[0]!.title });
    expect(client.calls).toEqual(['startProject']);
  });
});

describe('stage 2: discovery answer modes and provenance', () => {
  test('delegating a question replaces the answer field with the delegation it implies', async () => {
    await reachStage(new FakeArtDirectorClient(), 'discovery');
    const question = screen.getByRole('group', { name: /Primary audience/ });

    expect(within(question).getByLabelText('Answer for Primary audience')).toBeDefined();
    fireEvent.click(within(question).getByRole('radio', { name: 'Use your judgment' }));

    expect(within(question).queryByLabelText('Answer for Primary audience')).toBeNull();
    expect(
      within(question).getByText('Universal will make and explain this decision.')
    ).toBeDefined();
    expect(
      (within(question).getByRole('radio', { name: 'Use your judgment' }) as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  test('the compiled brief displays each decision under its authorship', async () => {
    await reachStage(new FakeArtDirectorClient(), 'brief');

    for (const heading of [
      'Your decisions',
      'Universal recommends',
      'Delegated decisions',
      'Needs attention'
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeDefined();
    }
    const recommended = screen
      .getByRole('heading', { name: 'Universal recommends' })
      .closest('section')!;
    expect(within(recommended).getByText('Typeface pairing')).toBeDefined();
    expect(within(recommended).getByText(/editorial weight/)).toBeDefined();
  });
});

describe('stage 3: creative-brief review and explicit approval', () => {
  test('approval requires an explicit acknowledgement, not just arriving at the stage', async () => {
    const client = new FakeArtDirectorClient();
    await reachStage(client, 'brief');

    expect(button(/Approve brief/)).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button(/Approve brief/)).toHaveProperty('disabled', false);

    fireEvent.click(button(/Approve brief/));
    expect(screen.getByRole('button', { name: /Developing direction/ })).toHaveProperty(
      'disabled',
      true
    );
    await screen.findByRole('heading', { name: direction.name });
    expect(client.calls).toEqual(['startProject', 'compileBrief', 'approveBrief']);
  });

  test('unresolved decisions are surfaced before approval is offered', async () => {
    await reachStage(new FakeArtDirectorClient(), 'brief');

    const notice = document.querySelector('.alert')!;
    expect(notice.textContent).toMatch(/1 high-impact choice remains open/);
  });
});

describe('stage 4: direction review and Design Plan v2', () => {
  test('presents the recommended direction with its rationale, risks, and alternatives', async () => {
    await reachStage(new FakeArtDirectorClient(), 'direction');

    expect(screen.getByText(direction.conceptSpine)).toBeDefined();
    expect(screen.getByText(direction.rationale)).toBeDefined();
    expect(screen.getByText(direction.risks[0]!)).toBeDefined();
    expect(screen.getByText(direction.alternatives[0]!.name)).toBeDefined();
  });

  test('approving the direction renders the Design Plan v2 document', async () => {
    const client = new FakeArtDirectorClient();
    await reachStage(client, 'plan');

    expect(screen.getByText(`Plan ${plan.version}`)).toBeDefined();
    expect(screen.getByText(`${plan.pages.length} routes`)).toBeDefined();
    expect(screen.getByText(`${plan.confidence}% confidence`)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Page specifications' })).toBeDefined();
    expect(screen.getByText(plan.pages[0]!.sections[0]!.responsibility)).toBeDefined();
    expect(screen.getByText(plan.constraints[0]!)).toBeDefined();
    expect(client.calls).toEqual([
      'startProject',
      'compileBrief',
      'approveBrief',
      'approveDirection'
    ]);
  });

  test('stages stay locked until the work that unlocks them is done', async () => {
    renderStudio(new FakeArtDirectorClient());
    const progress = screen.getByRole('navigation', { name: 'Project progress' });

    for (const stage of ['Brief', 'Direction', 'Plan']) {
      expect(within(progress).getByRole('button', { name: new RegExp(stage) })).toHaveProperty(
        'disabled',
        true
      );
    }
  });
});

describe('recoverable client failure', () => {
  test('a failed start is reported, keeps the prompt, and can be retried', async () => {
    const client = new FakeArtDirectorClient({ failStartTimes: 1 });
    renderStudio(client);

    fireEvent.change(promptField(), { target: { value: VALID_PROMPT } });
    fireEvent.click(button(/Begin discovery/));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Discovery could not start/);
    expect(alert.textContent).toMatch(/could not be reached/);
    expect(promptField().value).toBe(VALID_PROMPT);

    const retry = button(/Begin discovery/);
    expect(retry).toHaveProperty('disabled', false);
    retry.focus();
    expect(document.activeElement).toBe(retry);

    fireEvent.click(retry);
    await screen.findByRole('heading', { name: groups[0]!.title });
    expect(client.calls).toEqual(['startProject', 'startProject']);
    await waitFor(() => expect(screen.queryByText(/Discovery could not start/)).toBeNull());
  });
});

describe('shell semantics', () => {
  test('exposes a skip link and a named main region for keyboard users', () => {
    renderStudio(new FakeArtDirectorClient());

    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip.getAttribute('href')).toBe('#content');
    expect(document.querySelector('main')!.id).toBe('content');
    skip.focus();
    expect(document.activeElement).toBe(skip);
  });
});
