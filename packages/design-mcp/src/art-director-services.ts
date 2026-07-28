import {
  DeterministicOfflineConceptProvider,
  compileDesignPlanV2,
  developConceptDirection,
  digestDirectionEvaluation,
  type ConceptCandidate,
  type ConceptDevelopmentProvider,
  type ConceptEvaluation,
  type CreativeBrief,
  type DecisionProvenance,
  type DesignPlanV2Draft,
  type PlanDecisionProvenance,
  type SelectedDirectionEvaluation
} from '@universal/design-engine';
import {
  createArtDirectorDependencies,
  type ArtDirectorDependencies,
  type ConceptDirectorService,
  type PlanCompilerService,
  type SelectedDirectionArtifact
} from './art-director.js';

const HIGH_IMPACT_TOPICS = new Set([
  'purpose',
  'audience',
  'page-map',
  'page-content',
  'hero',
  'navigation',
  'brand-assets'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function selectedCandidate(selected: SelectedDirectionArtifact): ConceptCandidate {
  if (!isRecord(selected.candidate) || typeof selected.candidate.id !== 'string')
    throw new Error('Selected direction is missing a ConceptCandidate.');
  return selected.candidate as unknown as ConceptCandidate;
}

function selectedEvaluation(selected: SelectedDirectionArtifact): ConceptEvaluation {
  if (!isRecord(selected.evaluation) || typeof selected.evaluation.totalScore !== 'number')
    throw new Error('Selected direction is missing a policy-owned ConceptEvaluation.');
  return selected.evaluation as unknown as ConceptEvaluation;
}

function acceptedProvenance(decision: DecisionProvenance): PlanDecisionProvenance | undefined {
  let sourceKind: PlanDecisionProvenance['sourceKind'] | undefined;
  if (
    decision.source === 'user' &&
    ['explicit', 'preferred'].includes(decision.disposition) &&
    !decision.requiresConfirmation
  )
    sourceKind = 'user-decision';
  else if (
    decision.source === 'repository' &&
    ['explicit', 'preferred'].includes(decision.disposition) &&
    !decision.requiresConfirmation
  )
    sourceKind = 'supplied-evidence';
  else if (
    ['assumed', 'delegated', 'drafted'].includes(decision.disposition) &&
    !decision.requiresConfirmation
  )
    sourceKind = 'approved-assumption';
  if (!sourceKind) return undefined;
  return {
    id: `brief:${decision.id}`,
    sourceKind,
    sourceId: decision.id,
    evidence: decision.evidence,
    approved: true
  };
}

function buildDirectionEvaluation(
  brief: CreativeBrief,
  selected: SelectedDirectionArtifact
): SelectedDirectionEvaluation {
  const candidate = selectedCandidate(selected);
  const evaluation = selectedEvaluation(selected);
  const unsigned: Omit<SelectedDirectionEvaluation, 'digest'> = {
    contractVersion: '1.0.0',
    id: `direction-evaluation:${candidate.id}`,
    status: 'selected',
    briefId: brief.id,
    briefVersion: brief.version,
    briefDigest: brief.digest,
    selectedDirection: {
      id: candidate.id,
      label: candidate.title,
      conceptSpine: candidate.centralIdea,
      emotionalObjective:
        brief.content.emotionalResponse?.summary ??
        `Help ${brief.content.audience.summary} feel understood and confident enough to act.`,
      recommendation: selected.rationale
    },
    rationale: selected.rationale,
    score: Math.max(0, Math.min(1, evaluation.totalScore / 100)),
    unresolvedDependencies: [],
    evaluatedAt: selected.selectedAt
  };
  return { ...unsigned, digest: digestDirectionEvaluation(unsigned) };
}

function buildDraft(
  brief: CreativeBrief,
  evaluation: SelectedDirectionEvaluation,
  selected: SelectedDirectionArtifact
): DesignPlanV2Draft {
  const candidate = selectedCandidate(selected);
  const accepted = brief.decisions
    .map((decision) => ({ decision, provenance: acceptedProvenance(decision) }))
    .filter(
      (entry): entry is { decision: DecisionProvenance; provenance: PlanDecisionProvenance } =>
        entry.provenance !== undefined
    );
  const directionProvenance: PlanDecisionProvenance = {
    id: 'direction:selected',
    sourceKind: 'universal-recommendation',
    sourceId: evaluation.selectedDirection.id,
    evidence: evaluation.rationale,
    approved: true
  };
  const decisionProvenance = [...accepted.map((entry) => entry.provenance), directionProvenance];
  const provenanceFor = (topic?: DecisionProvenance['topic']): readonly string[] => {
    const match = topic
      ? [...accepted].reverse().find((entry) => entry.decision.topic === topic)?.provenance.id
      : undefined;
    return match ? [match, directionProvenance.id] : [directionProvenance.id];
  };
  const trace = <T>(value: T, rationale: string, topic?: DecisionProvenance['topic']) => ({
    value,
    rationale,
    provenanceIds: provenanceFor(topic)
  });
  const allSections = brief.content.pageMap.pages.flatMap((page) => page.requiredSections);
  const assumptions = accepted
    .filter((entry) => entry.provenance.sourceKind === 'approved-assumption')
    .map((entry) => ({
      id: `assumption:${entry.decision.id}`,
      statement: entry.decision.value.summary,
      impact: HIGH_IMPACT_TOPICS.has(entry.decision.topic)
        ? ('high' as const)
        : ('medium' as const),
      provenanceIds: [entry.provenance.id]
    }));
  const delegatedDecisions = accepted
    .filter((entry) => entry.decision.disposition === 'delegated')
    .map((entry) => ({
      id: `delegated:${entry.decision.id}`,
      scope: entry.decision.value.summary,
      guardrails: entry.decision.value.details?.length
        ? [...entry.decision.value.details]
        : [`Remain within the approved ${entry.decision.topic} decision.`],
      provenanceIds: [entry.provenance.id]
    }));

  return {
    conceptSpine: trace(candidate.centralIdea, 'Preserves the policy-selected concept spine.'),
    emotionalObjective: trace(
      evaluation.selectedDirection.emotionalObjective,
      'Translates the approved audience and emotional intent into the selected direction.',
      'audience'
    ),
    pageNarrative: trace(
      brief.content.pageMap.pages.map((page) => ({
        pageId: page.id,
        role: page.uniqueResponsibility,
        entryState: page.userGoal,
        exitState: page.primaryAction ?? page.primaryMessage
      })),
      'Copies every approved route into one explicit narrative arc.',
      'page-map'
    ),
    navigationSignature: trace(
      {
        mode: candidate.navigationPhilosophy,
        hierarchy:
          brief.content.navigation?.summary ?? 'Page responsibilities determine hierarchy.',
        desktopBehavior:
          'Expose the approved routes and current location without obscuring content.',
        mobileBehavior: 'Collapse to a touch-safe index that preserves route names and order.',
        relationshipToHero: 'Navigation frames the hero while leaving its primary message dominant.'
      },
      'Combines the approved navigation intent with the selected concept.',
      'navigation'
    ),
    compositionSignature: trace(
      {
        layoutFamily: candidate.composition,
        heroStrategy: candidate.centralIdea,
        gridStrategy: candidate.composition,
        rhythm: candidate.narrativeStructure,
        sectionSequence: allSections.length > 0 ? allSections : ['opening']
      },
      'Uses the selected direction’s structural dimensions rather than palette-only variation.'
    ),
    sectionIntentions: brief.content.pageMap.pages.flatMap((page) =>
      page.requiredSections.map((requiredSection, index) => ({
        id: `section:${page.id}:${index + 1}`,
        pageId: page.id,
        requiredSection,
        intention: `${requiredSection} advances ${page.primaryMessage}`,
        contentRequirements:
          index === 0 && page.requiredContent.length > 0
            ? [...page.requiredContent]
            : [requiredSection],
        rationale: `Fulfills the approved responsibility for ${page.name}.`,
        provenanceIds: provenanceFor('page-map')
      }))
    ),
    typographySystem: trace(
      {
        display: candidate.typographyIntent,
        body: 'A highly legible companion face supports long-form and utility content.',
        roles: ['display', 'body', 'navigation', 'annotation'],
        scaleStrategy: 'Use controlled contrast in scale while preserving readable measures.'
      },
      'Makes the selected typography intent production-addressable.',
      'typography'
    ),
    colorSystem: trace(
      {
        roles: [
          { role: 'ground', value: '#171716', usage: 'Primary page ground and dark surfaces.' },
          { role: 'text', value: '#F4F2EC', usage: 'Primary text with AA contrast.' },
          { role: 'signal', value: '#C85B3C', usage: 'Actions, focus, and purposeful emphasis.' }
        ],
        contrastStrategy: `Meet WCAG AA and honor: ${brief.content.color?.summary ?? 'the selected direction’s restrained palette'}.`
      },
      'Protects contrast while translating the approved palette intent.',
      'color'
    ),
    imageryDirection: trace(
      {
        subject: brief.content.imagery?.summary ?? candidate.imageryIntent,
        treatment: candidate.imageryIntent,
        sourcing: 'Use licensed, supplied, or commissioned imagery with recorded provenance.',
        accessibility:
          'Provide meaningful alternatives and never encode required information in imagery alone.'
      },
      'Binds imagery subject and treatment to the approved brief and selected direction.',
      'imagery'
    ),
    iconographyDirection: trace(
      {
        style: 'Use a restrained, coherent symbol family derived from the selected direction.',
        usage: 'Reserve icons for orientation, state, and recognizable actions.',
        accessibility: 'Pair unfamiliar icons with labels and expose accessible names.'
      },
      'Prevents decorative iconography from replacing content.'
    ),
    responsiveTransformations: trace(
      [
        {
          target: 'navigation',
          desktop: 'Persistent route context.',
          mobile: candidate.responsiveBehavior,
          preserve: 'Route names, order, and current location.'
        },
        {
          target: 'hero',
          desktop: 'Full composition and deliberate scale contrast.',
          mobile: 'Reflow to one readable opening sequence.',
          preserve: 'Primary message and action hierarchy.'
        },
        {
          target: 'sections',
          desktop: candidate.composition,
          mobile: 'Stack in semantic reading order.',
          preserve: 'Every required section and content item.'
        },
        {
          target: 'typography',
          desktop: candidate.typographyIntent,
          mobile: 'Clamp display scale and maintain readable measure.',
          preserve: 'Role hierarchy and legibility.'
        },
        {
          target: 'imagery',
          desktop: candidate.imageryIntent,
          mobile: candidate.responsiveBehavior,
          preserve: 'Subject, meaning, and alternative text.'
        }
      ],
      'Defines explicit transformations instead of proportional shrinking.'
    ),
    motionStrategy: trace(
      {
        principles: [
          'Motion clarifies state and sequence.',
          'No motion gates content or navigation.'
        ],
        reducedMotion: 'Render all content immediately and remove non-essential transforms.'
      },
      'Keeps interaction purposeful and accessible.'
    ),
    protectedInvariants: [
      {
        id: 'invariant:page',
        area: 'page',
        statement: 'Preserve every approved route and responsibility.',
        rationale: 'Page scope is user-approved.',
        provenanceIds: provenanceFor('page-map')
      },
      {
        id: 'invariant:navigation',
        area: 'navigation',
        statement: 'Preserve approved route hierarchy and predictable access.',
        rationale: 'Navigation is a high-impact structural decision.',
        provenanceIds: provenanceFor('navigation')
      },
      {
        id: 'invariant:hero',
        area: 'hero',
        statement:
          brief.content.hero?.summary ?? 'Keep the opening aligned to the selected concept.',
        rationale: 'The opening controls first-read clarity.',
        provenanceIds: provenanceFor('hero')
      },
      {
        id: 'invariant:brand',
        area: 'brand',
        statement:
          brief.content.brandAssets?.summary ?? 'Do not invent or imply unavailable brand assets.',
        rationale: 'Brand claims require approved evidence.',
        provenanceIds: provenanceFor('brand-assets')
      },
      {
        id: 'invariant:content',
        area: 'content',
        statement: brief.content.pageContent.summary,
        rationale: 'Required content must survive implementation.',
        provenanceIds: provenanceFor('page-content')
      }
    ],
    prohibitedPatterns: trace(
      brief.content.antiPatterns.length > 0
        ? [...brief.content.antiPatterns]
        : [
            'Generic centered hero',
            'Repeated floating-card grid',
            'Decorative gradient without meaning'
          ],
      'Carries explicit anti-references into implementation constraints.',
      'anti-patterns'
    ),
    assumptions,
    delegatedDecisions,
    decisionProvenance
  };
}

export function createConceptDirectorService(
  provider: ConceptDevelopmentProvider = new DeterministicOfflineConceptProvider()
): ConceptDirectorService {
  return { develop: (brief) => developConceptDirection(brief, provider) };
}

export function createPlanCompilerService(): PlanCompilerService {
  return {
    async compile({ brief, selectedDirection }) {
      const evaluation = buildDirectionEvaluation(brief, selectedDirection);
      const draft = buildDraft(brief, evaluation, selectedDirection);
      return compileDesignPlanV2({
        brief,
        evaluation,
        providerOutput: JSON.stringify(draft),
        now: selectedDirection.selectedAt
      });
    }
  };
}

export function createIntegratedArtDirectorDependencies(
  overrides: Partial<ArtDirectorDependencies> = {}
): ArtDirectorDependencies {
  return createArtDirectorDependencies({
    conceptDirector: createConceptDirectorService(),
    planCompiler: createPlanCompilerService(),
    ...overrides
  });
}
