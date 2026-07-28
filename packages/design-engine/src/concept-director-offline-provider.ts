import type {
  ConceptCandidate,
  ConceptDevelopmentProvider,
  ConceptDevelopmentRequest
} from './concept-director-contracts.ts';

function sharedAlignment(request: ConceptDevelopmentRequest): readonly string[] {
  const { content } = request.brief;
  return [
    content.purpose.summary,
    content.audience.summary,
    content.pageContent.summary,
    content.pageMap.pages[0]?.primaryMessage ?? content.purpose.summary
  ];
}

function baseCandidates(request: ConceptDevelopmentRequest): readonly ConceptCandidate[] {
  const alignment = sharedAlignment(request);
  return [
    {
      id: 'concept-editorial-argument',
      title: 'The Editorial Argument',
      centralIdea:
        'Turn the approved product promise into a decisive editorial thesis that unfolds through evidence.',
      narrativeStructure:
        'Open with the outcome, name the audience problem, reveal the method in chapters, then close with proof and action.',
      composition:
        'An asymmetric column grid uses large type, generous negative space, controlled overlap, and a clear vertical rhythm.',
      navigationPhilosophy:
        'A quiet persistent index exposes the story chapters and keeps the primary action available without dominating.',
      typographyIntent:
        'A characterful editorial serif carries thesis-scale headlines; a neutral sans uses disciplined measure and weight for utility.',
      imageryIntent:
        'Documentary photography uses tightly observed subjects, deliberate crops, natural lighting, and factual captions as evidence.',
      interactionPhilosophy:
        'Measured reveals follow reading progress; focus and hover states clarify available actions without decorative motion.',
      responsiveBehavior:
        'The asymmetric grid reflows to a single mobile reading order, while chapter navigation becomes a touch-safe progressive index.',
      accessibilityIntent:
        'Semantic landmarks, visible keyboard focus, strong contrast, stable reading order, and reduced-motion alternatives are mandatory.',
      briefAlignment: alignment,
      strengths: ['Immediate positioning clarity', 'Strong content hierarchy', 'Credible proof'],
      weaknesses: ['Requires disciplined copy editing'],
      risks: ['Weak photography would reduce the editorial authority'],
      rejectedDefaults: [
        'Decorative gradient hero',
        'Floating feature cards',
        'Generic dashboard mockup'
      ]
    },
    {
      id: 'concept-guided-instrument',
      title: 'The Guided Instrument',
      centralIdea:
        'Make the experience behave like a precise working instrument that lets visitors rehearse the promised outcome.',
      narrativeStructure:
        'Begin with one practical question, move through an input-to-outcome sequence, surface proof at decision points, then invite commitment.',
      composition:
        'A modular rail grid pairs a stable control plane with changing scenario panels, using scale and alignment to preserve hierarchy.',
      navigationPhilosophy:
        'Task-based navigation names visitor decisions instead of page sections, with a persistent route back to the current scenario.',
      typographyIntent:
        'A compact grotesk establishes interface clarity while a restrained mono face marks inputs, states, measures, and proof details.',
      imageryIntent:
        'Explanatory diagrams and annotated product fragments replace decorative imagery; every visual answers a user question.',
      interactionPhilosophy:
        'Direct manipulation and reversible state changes demonstrate value, with keyboard parity, explicit feedback, and no hidden gestures.',
      responsiveBehavior:
        'Desktop rails reflow into a mobile sequence of stacked steps; controls use full-width touch targets and preserve state between viewports.',
      accessibilityIntent:
        'Every control has a semantic label, visible focus, keyboard operation, status announcements, sufficient contrast, and reduced motion.',
      briefAlignment: alignment,
      strengths: ['Makes the product logic tangible', 'High interaction clarity', 'Strong utility'],
      weaknesses: ['More implementation effort than a passive narrative'],
      risks: ['An overbuilt demo could compete with the primary conversion action'],
      rejectedDefaults: ['Autoplay product tour', 'Hover-only explanations', 'Generic bento grid']
    },
    {
      id: 'concept-human-field-notes',
      title: 'Human Field Notes',
      centralIdea:
        'Frame the approved promise through the lived moments and language of the people the product is meant to help.',
      narrativeStructure:
        'Start inside a recognizable moment, alternate short human stories with product responses, collect proof, and end on a shared future state.',
      composition:
        'A cinematic sequence alternates full-bleed scenes, narrow testimony measures, and quiet proof bands with deliberate pacing and scale.',
      navigationPhilosophy:
        'A minimal story map favors exploration by human moment, while conventional route labels remain visible and predictable.',
      typographyIntent:
        'A warm humanist sans handles narrative voices with open leading; a high-contrast display face marks emotional turning points.',
      imageryIntent:
        'Environmental photography centers real subjects and contextual texture, using wide establishing crops and intimate detail crops.',
      interactionPhilosophy:
        'Subtle chapter transitions and optional story expansion reward attention; motion never gates content or changes reading order.',
      responsiveBehavior:
        'Wide scenes become art-directed mobile crops, testimony and proof stack in reading order, and the story map becomes a compact touch list.',
      accessibilityIntent:
        'Descriptive alternatives, transcript-equivalent story content, semantic structure, visible focus, strong contrast, and reduced motion are built in.',
      briefAlignment: alignment,
      strengths: [
        'Emotional specificity',
        'Memorable audience connection',
        'Natural proof narrative'
      ],
      weaknesses: ['Depends on access to authentic stories'],
      risks: ['Stock-like imagery would undermine trust'],
      rejectedDefaults: ['Anonymous avatar testimonials', 'Neon glow', 'Abstract blob illustration']
    }
  ];
}

export class DeterministicOfflineConceptProvider implements ConceptDevelopmentProvider {
  async developConcepts(request: ConceptDevelopmentRequest): Promise<unknown> {
    const seeds = baseCandidates(request);
    const candidates = Array.from({ length: request.candidateCount }, (_, index) => {
      const seed = seeds[index % seeds.length]!;
      if (index < seeds.length) return seed;
      return {
        ...seed,
        id: `${seed.id}-${index + 1}`,
        title: `${seed.title} ${index + 1}`,
        centralIdea: `${seed.centralIdea} Iteration ${index + 1} emphasizes a distinct route.`
      };
    });
    return { candidates };
  }
}
