import { fixtureCreativeBrief } from './fixtures.ts';
import type {
  DesignPlanV2Draft,
  SelectedDirectionEvaluation,
  TraceableDecision
} from './design-plan-v2-contracts.ts';
import { digestDirectionEvaluation } from './design-plan-v2-digests.ts';

const trace = <Value>(
  value: Value,
  rationale: string,
  provenanceIds: readonly string[] = ['prov:direction']
): TraceableDecision<Value> => ({ value, rationale, provenanceIds });

const unsignedEvaluation: Omit<SelectedDirectionEvaluation, 'digest'> = {
  contractVersion: '1.0.0',
  id: 'evaluation:printed-folio',
  status: 'selected',
  briefId: fixtureCreativeBrief.id,
  briefVersion: fixtureCreativeBrief.version,
  briefDigest: fixtureCreativeBrief.digest,
  selectedDirection: {
    id: 'direction:printed-folio',
    label: 'Printed folio',
    conceptSpine: 'A climate architecture journal composed as a living printed folio.',
    emotionalObjective: 'Make adaptation feel urgent, credible, and carefully considered.',
    recommendation: 'Use an editorial masthead and captioned image plates.'
  },
  rationale: 'The direction best expresses the approved editorial purpose and audience.',
  score: 0.92,
  unresolvedDependencies: [],
  evaluatedAt: '2026-07-27T12:05:00.000Z'
};

export const fixtureSelectedDirectionEvaluation: SelectedDirectionEvaluation = {
  ...unsignedEvaluation,
  digest: digestDirectionEvaluation(unsignedEvaluation)
};

export const fixtureDesignPlanV2Draft: DesignPlanV2Draft = {
  conceptSpine: trace(
    unsignedEvaluation.selectedDirection.conceptSpine,
    'The selected concept translates the approved publishing purpose into a recognizable system.'
  ),
  emotionalObjective: trace(
    unsignedEvaluation.selectedDirection.emotionalObjective,
    'The emotional objective follows the selected evaluation without provider reinterpretation.'
  ),
  pageNarrative: trace(
    [
      {
        pageId: 'home',
        role: 'Frame the issue and guide readers into the project archive.',
        entryState: 'Curious about architecture for a changing climate.',
        exitState: 'Ready to browse projects, understand the journal, or subscribe.'
      }
    ],
    'The narrative follows the approved single-page responsibility.',
    ['prov:page-map']
  ),
  navigationSignature: trace(
    {
      mode: 'editorial masthead with section anchors',
      hierarchy: 'Issue identity first, reading destinations second, utility last.',
      desktopBehavior: 'Two-row masthead with visible section anchors.',
      mobileBehavior: 'Compact identity row with an accessible disclosure menu.',
      relationshipToHero: 'The masthead and opening headline share one typographic frame.'
    },
    'Integrated navigation preserves the publication hierarchy.'
  ),
  compositionSignature: trace(
    {
      layoutFamily: 'asymmetric editorial folio',
      heroStrategy: 'offset issue statement paired with a captioned image plate',
      gridStrategy: 'six-column desktop grid collapsing to a single reading column',
      rhythm: 'monumental opener followed by measured editorial intervals',
      sectionSequence: ['masthead', 'issue introduction', 'project index', 'about', 'subscribe']
    },
    'The selected direction requires a folio-like composition rather than a generic card grid.'
  ),
  sectionIntentions: [
    {
      id: 'intention:masthead',
      pageId: 'home',
      requiredSection: 'masthead',
      intention: 'Establish issue identity, navigation, and editorial authority.',
      contentRequirements: ['issue title', 'editorial introduction', 'project summaries'],
      rationale: 'The opening must orient readers before the archive.',
      provenanceIds: ['prov:page-map', 'prov:direction']
    },
    {
      id: 'intention:introduction',
      pageId: 'home',
      requiredSection: 'issue introduction',
      intention: 'State the climate thesis in concise editorial language.',
      contentRequirements: ['editorial introduction'],
      rationale: 'The approved page message needs an explicit narrative bridge.',
      provenanceIds: ['prov:purpose']
    },
    {
      id: 'intention:index',
      pageId: 'home',
      requiredSection: 'project index',
      intention: 'Offer a browsable, captioned index of featured work.',
      contentRequirements: ['project summaries'],
      rationale: 'Browsing projects is the approved primary action.',
      provenanceIds: ['prov:page-map']
    },
    {
      id: 'intention:about',
      pageId: 'home',
      requiredSection: 'about',
      intention: 'Explain the journal mandate without interrupting the reading flow.',
      contentRequirements: ['journal mandate'],
      rationale: 'Readers need institutional context before subscribing.',
      provenanceIds: ['prov:page-map']
    },
    {
      id: 'intention:subscribe',
      pageId: 'home',
      requiredSection: 'subscribe',
      intention: 'Close with a clear invitation to follow future issues.',
      contentRequirements: ['subscription invitation'],
      rationale: 'Subscription is an approved secondary action.',
      provenanceIds: ['prov:page-map']
    }
  ],
  typographySystem: trace(
    {
      display: 'High-contrast editorial serif',
      body: 'Neutral grotesk sans serif',
      roles: ['issue display', 'section headline', 'body', 'caption', 'utility'],
      scaleStrategy: 'Large display jumps with a restrained modular reading scale.'
    },
    'Family, scale, and density contrast separate editorial voice from utility.',
    ['prov:delegated-typography']
  ),
  colorSystem: trace(
    {
      roles: [
        { role: 'background', value: 'warm near-black', usage: 'Primary canvas' },
        { role: 'text', value: 'paper white', usage: 'Primary readable text' },
        { role: 'accent', value: 'oxide rust', usage: 'Rare hierarchy and focus cues' }
      ],
      contrastStrategy: 'Maintain WCAG AA for text and never rely on accent color alone.'
    },
    'A restrained ink-and-stock palette supports the folio concept.'
  ),
  imageryDirection: trace(
    {
      subject: 'Built work responding to changing climates',
      treatment: 'Documentary image plates with factual captions and varied scale',
      sourcing: 'Use supplied or licensed project photography; identify placeholders explicitly',
      accessibility: 'Provide content-specific alt text and keep captions available as text'
    },
    'Real architectural evidence is central to editorial credibility.'
  ),
  iconographyDirection: trace(
    {
      style: 'Sparse monoline editorial symbols',
      usage: 'Use only for utility actions where text remains available',
      accessibility: 'Decorative icons are hidden; controls retain accessible names'
    },
    'Restrained iconography prevents the publication from reading like an app dashboard.'
  ),
  responsiveTransformations: trace(
    [
      {
        target: 'navigation',
        desktop: 'Visible anchor row',
        mobile: 'Disclosure menu',
        preserve: 'Destination order and issue identity'
      },
      {
        target: 'hero',
        desktop: 'Offset text and image plate',
        mobile: 'Text then full-width image',
        preserve: 'Headline dominance and caption relationship'
      },
      {
        target: 'sections',
        desktop: 'Alternating six-column placements',
        mobile: 'Single reading column',
        preserve: 'Narrative and section order'
      },
      {
        target: 'typography',
        desktop: 'Monumental display scale',
        mobile: 'Fluid display with safe wrapping',
        preserve: 'Role contrast and hierarchy'
      },
      {
        target: 'imagery',
        desktop: 'Inset and full-bleed plates',
        mobile: 'Edge-to-edge plates',
        preserve: 'Subject crop and visible captions'
      }
    ],
    'Responsive changes transform composition while protecting the editorial hierarchy.'
  ),
  motionStrategy: trace(
    {
      principles: ['Use motion only to explain hierarchy or state', 'Keep reading content stable'],
      reducedMotion: 'Remove transforms and scrubbing; preserve every state and all content.'
    },
    'The concept is carried by composition, so motion remains supportive and optional.'
  ),
  protectedInvariants: [
    {
      id: 'invariant:page',
      area: 'page',
      statement: 'Keep the approved single-page route and section responsibilities.',
      rationale: 'Page scope is user-approved.',
      provenanceIds: ['prov:page-map']
    },
    {
      id: 'invariant:navigation',
      area: 'navigation',
      statement: 'Navigation must expose every approved destination.',
      rationale: 'Navigation cannot silently hide required content.',
      provenanceIds: ['prov:page-map']
    },
    {
      id: 'invariant:hero',
      area: 'hero',
      statement: 'The opening must express the selected climate-folio concept.',
      rationale: 'The hero is a selected-direction decision.',
      provenanceIds: ['prov:direction']
    },
    {
      id: 'invariant:brand',
      area: 'brand',
      statement: 'Do not invent logos, claims, or brand assets.',
      rationale: 'No supplied brand system authorizes invention.',
      provenanceIds: ['prov:direction']
    },
    {
      id: 'invariant:content',
      area: 'content',
      statement: 'Retain every approved required content item and label placeholders.',
      rationale: 'Content requirements are approval-bound.',
      provenanceIds: ['prov:page-map']
    }
  ],
  prohibitedPatterns: trace(
    [
      'dashboard card grids',
      'generic app navbar',
      'unlabeled invented content',
      'decorative motion dependencies'
    ],
    'These patterns conflict with the editorial direction and approval boundaries.'
  ),
  assumptions: [
    {
      id: 'assumption:typography',
      statement: 'Universal may choose the final type families within the declared roles.',
      impact: 'medium',
      provenanceIds: ['prov:delegated-typography']
    }
  ],
  delegatedDecisions: [
    {
      id: 'delegated:type-family',
      scope: 'Choose production-safe type families.',
      guardrails: [
        'Preserve serif/sans role contrast',
        'Meet performance and language coverage needs'
      ],
      provenanceIds: ['prov:delegated-typography']
    }
  ],
  decisionProvenance: [
    {
      id: 'prov:purpose',
      sourceKind: 'user-decision',
      sourceId: 'decision:purpose:1',
      evidence: 'Approved purpose decision.',
      approved: true
    },
    {
      id: 'prov:page-map',
      sourceKind: 'user-decision',
      sourceId: 'decision:page-map:1',
      evidence: 'Approved page map decision.',
      approved: true
    },
    {
      id: 'prov:direction',
      sourceKind: 'universal-recommendation',
      sourceId: 'direction:printed-folio',
      evidence: 'Selected and digest-bound direction evaluation.',
      approved: true
    },
    {
      id: 'prov:delegated-typography',
      sourceKind: 'approved-assumption',
      sourceId: 'decision:typography:1',
      evidence: 'User delegated typography judgment before brief approval.',
      approved: true
    }
  ]
};

export const serializedFixtureDesignPlanV2Draft = `${JSON.stringify(fixtureDesignPlanV2Draft, null, 2)}\n`;
