import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ART_DIRECTION_BENCHMARK_DIMENSIONS,
  evaluateArtDirectionBenchmark,
  type ArtDirectionBenchmarkEvidence,
  type ArtDirectionCandidateEvidence,
  type ArtDirectionDecisionEvidence
} from '../src/index.ts';

function candidate(
  id: string,
  values: readonly [string, string, string, string, string, string, string, string]
): ArtDirectionCandidateEvidence {
  return {
    id,
    centralIdea: values[0],
    narrativeStructure: values[1],
    composition: values[2],
    navigationPhilosophy: values[3],
    typographyIntent: values[4],
    imageryIntent: values[5],
    interactionPhilosophy: values[6],
    responsiveBehavior: values[7],
    rejectedDefaults: ['Floating feature cards', 'Generic centered hero', 'Decorative gradient']
  };
}

function evidence(): ArtDirectionBenchmarkEvidence {
  const topics = [
    'purpose',
    'audience',
    'hero',
    'color',
    'navigation',
    'page-map',
    'page-content',
    'imagery'
  ];
  const candidates = [
    candidate('editorial', [
      'A material editorial argument makes the keyboard a lasting desktop instrument.',
      'Thesis, manufacturing evidence, tactile proof, configuration, and purchase.',
      'Asymmetric folio columns with monumental type and precise rules.',
      'A quiet indexed masthead exposes products, craft, journal, and support.',
      'Condensed display sans with a measured grotesk body face.',
      'Macro material photography and factual workshop documentary crops.',
      'Measured reveals clarify assembly and configuration state.',
      'Columns reflow into a numbered mobile folio with preserved reading order.'
    ]),
    candidate('instrument', [
      'A calibration instrument lets buyers tune sound, feel, and layout.',
      'Question, direct manipulation, comparison, validation, then commitment.',
      'Stable control rail beside changing technical scenario panels.',
      'Task routes behave like controls with persistent configuration context.',
      'Compact grotesk and mono notation mark inputs and measured outputs.',
      'Exploded diagrams and annotated switch sections replace lifestyle imagery.',
      'Reversible controls provide immediate keyboard-operable feedback.',
      'Rails become full-width sequential steps with retained configuration state.'
    ]),
    candidate('workshop', [
      'A human workshop chronicle frames ownership as long-term stewardship.',
      'Maker portrait, material origin, assembly ritual, repair promise, invitation.',
      'Cinematic field bands alternate portraits, benches, and repair records.',
      'A story map follows people, processes, materials, and service milestones.',
      'Warm humanist text with a high-contrast display voice for chapter turns.',
      'Environmental portraits, tool traces, and imperfect workshop textures.',
      'Optional chapters unfold without gating content or changing order.',
      'Wide scenes become art-directed crops and stories stack by chapter.'
    ])
  ];
  return {
    brief: {
      id: 'brief:keyboard',
      version: 1,
      digest: 'brief-digest',
      approval: {
        status: 'approved',
        approvedDigest: 'brief-digest',
        approvedBy: 'benchmark-user'
      },
      decisions: topics.map((topic, index) => ({
        id: `decision:${topic}:${index}`,
        topic,
        source: 'user',
        disposition: topic === 'color' ? 'preferred' : 'explicit',
        requiresConfirmation: false
      })),
      pageIds: ['home', 'product', 'craft']
    },
    concepts: {
      approvedBriefDigest: 'brief-digest',
      digest: 'concept-digest',
      candidates,
      evaluations: candidates.map((item, index) => ({
        candidateId: item.id,
        eligible: true,
        criteria: {
          approvedBriefFit: { score: index === 0 ? 8.5 : 7.5 },
          genericPatternResistance: { score: 8 }
        }
      })),
      recommendedCandidateId: 'editorial'
    },
    selectedDirection: {
      approvedBriefDigest: 'brief-digest',
      conceptDigest: 'concept-digest',
      candidateId: 'editorial',
      digest: 'direction-digest'
    },
    plan: {
      contractVersion: '2.0.0',
      digest: 'plan-digest',
      source: {
        briefId: 'brief:keyboard',
        briefVersion: 1,
        briefDigest: 'brief-digest',
        approvedDigest: 'brief-digest',
        directionId: 'editorial'
      },
      pageIds: ['home', 'product', 'craft'],
      decisionProvenance: [
        { sourceKind: 'user-decision', sourceId: 'decision:audience:1', approved: true },
        { sourceKind: 'universal-recommendation', sourceId: 'editorial', approved: true }
      ]
    }
  };
}

test('Phase 2 benchmark passes all six art-direction dimensions', () => {
  const report = evaluateArtDirectionBenchmark(evidence());
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.dimensions.map((dimension) => dimension.dimension),
    ART_DIRECTION_BENCHMARK_DIMENSIONS
  );
  assert.ok(report.dimensions.every((dimension) => dimension.status === 'pass'));
});

test('Phase 2 benchmark independently detects every workflow regression class', () => {
  const cases: readonly [string, (value: ArtDirectionBenchmarkEvidence) => void][] = [
    [
      'discovery_coverage',
      (value) => (value.brief.decisions as unknown as ArtDirectionDecisionEvidence[]).splice(7, 1)
    ],
    [
      'no_silent_high_impact_assumptions',
      (value) => {
        const audience = value.brief.decisions.find((decision) => decision.topic === 'audience')!;
        audience.source = 'model';
        audience.disposition = 'assumed';
      }
    ],
    [
      'concept_differentiation',
      (value) => {
        const first = value.concepts.candidates[0]!;
        (value.concepts.candidates as unknown as ArtDirectionCandidateEvidence[]).splice(
          0,
          value.concepts.candidates.length,
          { ...first, id: 'one' },
          { ...first, id: 'two' },
          { ...first, id: 'three' }
        );
      }
    ],
    [
      'brief_fit',
      (value) => {
        value.concepts.evaluations[0]!.criteria.approvedBriefFit.score = 3;
      }
    ],
    [
      'generic_pattern_resistance',
      (value) => {
        value.concepts.evaluations[0]!.criteria.genericPatternResistance.score = 3;
      }
    ],
    [
      'approval_and_provenance_integrity',
      (value) => {
        value.brief.approval.approvedDigest = 'stale';
      }
    ]
  ];
  for (const [dimension, mutate] of cases) {
    const value = structuredClone(evidence());
    mutate(value);
    const report = evaluateArtDirectionBenchmark(value);
    assert.equal(report.passed, false, dimension);
    assert.equal(
      report.dimensions.find((item) => item.dimension === dimension)?.status,
      'fail',
      dimension
    );
  }
});
