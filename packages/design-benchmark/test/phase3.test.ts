import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PHASE3_BENCHMARK_DIMENSIONS,
  collectPhase3RenderedEvidence,
  evaluatePhase3Benchmark,
  type ArtDirectionBenchmarkEvidence,
  type ArtDirectionCandidateEvidence,
  type ArtDirectionDecisionEvidence,
  type Phase3BenchmarkEvidence,
  type Phase3BenchmarkDimension,
  type Phase3RenderedRepresentation,
  type Phase3RouteRepresentation
} from '../src/index.ts';

const digest = (character: string): string => character.repeat(64);

function candidate(
  id: string,
  theme: 'editorial' | 'instrument' | 'workshop'
): ArtDirectionCandidateEvidence {
  const values = {
    editorial: [
      'Material permanence as an editorial thesis.',
      'Thesis, proof, configuration, service.',
      'Asymmetric folio with monumental type.',
      'Quiet indexed masthead.',
      'Condensed display and measured grotesk.',
      'Macro materials and workshop crops.',
      'Measured assembly reveals.',
      'Numbered mobile folio.'
    ],
    instrument: [
      'A calibration instrument for sound and feel.',
      'Question, control, compare, commit.',
      'Technical rail and scenario field.',
      'Persistent task controls.',
      'Mono notation and compact grotesk.',
      'Exploded diagrams and switch sections.',
      'Reversible direct manipulation.',
      'Sequential retained controls.'
    ],
    workshop: [
      'A stewardship chronicle about repair.',
      'Maker, origin, ritual, repair, invitation.',
      'Cinematic chapters and documentary bands.',
      'Story map by people and process.',
      'Humanist text and chapter display.',
      'Portraits, tools, and surface traces.',
      'Optional ungated chapters.',
      'Art-directed stacked stories.'
    ]
  }[theme];
  return {
    id,
    centralIdea: values[0]!,
    narrativeStructure: values[1]!,
    composition: values[2]!,
    navigationPhilosophy: values[3]!,
    typographyIntent: values[4]!,
    imageryIntent: values[5]!,
    interactionPhilosophy: values[6]!,
    responsiveBehavior: values[7]!,
    rejectedDefaults: ['generic centered hero', 'floating cards', 'decorative gradient']
  };
}

function workflow(): ArtDirectionBenchmarkEvidence {
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
    candidate('editorial', 'editorial'),
    candidate('instrument', 'instrument'),
    candidate('workshop', 'workshop')
  ];
  return {
    brief: {
      id: 'brief:keyboard',
      version: 1,
      digest: 'brief-digest',
      approval: { status: 'approved', approvedDigest: 'brief-digest', approvedBy: 'human' },
      decisions: topics.map((topic, index) => ({
        id: `decision:${index}`,
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
      evaluations: candidates.map((item) => ({
        candidateId: item.id,
        eligible: true,
        criteria: { approvedBriefFit: { score: 8 }, genericPatternResistance: { score: 8 } }
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
      decisionProvenance: [{ sourceKind: 'user-decision', sourceId: 'decision:1', approved: true }]
    }
  };
}

function route(routePath: string, signature: string): Phase3RouteRepresentation {
  return {
    route: routePath,
    landmarkCount: 4,
    h1Count: 1,
    headingLevels: [1, 2, 2],
    typographyScaleSteps: 3,
    layoutSignature: signature,
    horizontalOverflow: false,
    readingOrderStable: true,
    visibleFocus: true,
    reducedMotionStable: true,
    prohibitedPatterns: [],
    externalNetworkRequests: [],
    privilegedRuntimeRequests: []
  };
}

function representations(): readonly Phase3RenderedRepresentation[] {
  const routes = [
    route('/', 'hero-folio'),
    route('/keyboards/monolith-75', 'configuration-ledger'),
    route('/craft', 'exploded-workshop')
  ];
  return [
    {
      id: 'desktop',
      viewport: { width: 1440, height: 1000 },
      screenshotSha256: digest('d'),
      routes: structuredClone(routes)
    },
    {
      id: 'mobile',
      viewport: { width: 390, height: 844 },
      screenshotSha256: digest('e'),
      routes: structuredClone(routes)
    }
  ];
}

function fixture(): Phase3BenchmarkEvidence {
  return {
    workflow: workflow(),
    generatedProject: {
      contractVersion: '1.0.0',
      requestDigest: digest('a'),
      manifestDigest: digest('b'),
      deterministicProvider: true,
      validationErrors: []
    },
    build: {
      status: 'ready',
      lockedInstall: true,
      deterministic: true,
      artifactDigest: digest('c')
    },
    pageMap: {
      expectedRoutes: ['/', '/keyboards/monolith-75', '/craft'],
      builtRoutes: ['/', '/keyboards/monolith-75', '/craft']
    },
    rendered: representations(),
    directionReview: {
      status: 'pass',
      reviewer: 'benchmark-reviewer',
      rationale: 'The rendered material folio preserves the selected editorial direction.'
    },
    compositionReview: {
      status: 'pass',
      reviewer: 'benchmark-reviewer',
      rationale:
        'The product ledger, home folio, and workshop sequence are compositionally distinct.'
    },
    preview: {
      status: 'ready',
      loopbackOnly: true,
      separateOrigin: true,
      cspConnectNone: true,
      privilegedEndpointStatus: 404
    },
    lastKnownGood: {
      priorBuildId: 'build:1',
      failedRebuildId: 'build:2',
      failedRebuildStatus: 'failed',
      activeBuildId: 'build:1',
      activeArtifactDigest: digest('c')
    }
  };
}

type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };
const mutable = <Value>(value: Value): Mutable<Value> => value;

test('Phase 3 benchmark evaluates all workflow, generated, rendered, isolation, and recovery dimensions', () => {
  const report = evaluatePhase3Benchmark(fixture());
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.dimensions.map((item) => item.dimension),
    PHASE3_BENCHMARK_DIMENSIONS
  );
  assert.equal(
    report.dimensions.find((item) => item.dimension === 'selected_direction_fidelity')
      ?.evidenceKind,
    'human'
  );
  assert.equal(
    report.dimensions.find((item) => item.dimension === 'preview_isolation')?.evidenceKind,
    'machine'
  );
});

test('rendered evidence collection is canonical and rejects unverifiable representations', () => {
  const collected = collectPhase3RenderedEvidence([...representations()].reverse());
  assert.deepEqual(
    collected.map((item) => item.id),
    ['desktop', 'mobile']
  );
  assert.throws(
    () =>
      collectPhase3RenderedEvidence([
        { ...representations()[0]!, screenshotSha256: 'not-a-digest' }
      ]),
    /SHA-256/
  );
  assert.throws(
    () => collectPhase3RenderedEvidence([representations()[0]!, representations()[0]!]),
    /Duplicate rendered representation/
  );
});

test('Phase 3 benchmark independently detects every regression class', () => {
  const cases: readonly [Phase3BenchmarkDimension, (value: Phase3BenchmarkEvidence) => void][] = [
    [
      'discovery_coverage',
      (value) => {
        (value.workflow.brief.decisions as unknown as ArtDirectionDecisionEvidence[]).splice(7, 1);
      }
    ],
    [
      'no_silent_high_impact_assumptions',
      (value) => {
        mutable(value.workflow.brief.decisions.find((item) => item.topic === 'audience')!).source =
          'model';
      }
    ],
    [
      'concept_differentiation',
      (value) => {
        const first = value.workflow.concepts.candidates[0]!;
        (value.workflow.concepts.candidates as unknown as ArtDirectionCandidateEvidence[]).splice(
          0,
          3,
          { ...first, id: 'one' },
          { ...first, id: 'two' },
          { ...first, id: 'three' }
        );
      }
    ],
    [
      'brief_fit',
      (value) => {
        mutable(value.workflow.concepts.evaluations[0]!.criteria.approvedBriefFit).score = 3;
      }
    ],
    [
      'generic_pattern_resistance',
      (value) => {
        mutable(value.workflow.concepts.evaluations[0]!.criteria.genericPatternResistance).score =
          3;
      }
    ],
    [
      'approval_and_provenance_integrity',
      (value) => {
        mutable(value.workflow.brief.approval).approvedDigest = 'stale';
      }
    ],
    [
      'generated_project_validity',
      (value) => {
        mutable(value.generatedProject).contractVersion = '0.0.0';
      }
    ],
    [
      'successful_deterministic_build',
      (value) => {
        mutable(value.build).lockedInstall = false;
      }
    ],
    [
      'page_map_coverage',
      (value) => {
        mutable(value.pageMap).builtRoutes = ['/'];
      }
    ],
    [
      'selected_direction_fidelity',
      (value) => {
        mutable(value.directionReview).status = 'fail';
      }
    ],
    [
      'typography_hierarchy',
      (value) => {
        mutable(value.rendered[0]!.routes[0]!).typographyScaleSteps = 1;
      }
    ],
    [
      'composition_differentiation',
      (value) => {
        for (const representation of value.rendered)
          for (const item of representation.routes) mutable(item).layoutSignature = 'same';
      }
    ],
    [
      'responsive_intent',
      (value) => {
        mutable(value.rendered[1]!.routes[0]!).horizontalOverflow = true;
      }
    ],
    [
      'accessibility_essentials',
      (value) => {
        mutable(value.rendered[0]!.routes[0]!).visibleFocus = false;
      }
    ],
    [
      'reduced_motion_behavior',
      (value) => {
        mutable(value.rendered[0]!.routes[0]!).reducedMotionStable = false;
      }
    ],
    [
      'prohibited_pattern_resistance',
      (value) => {
        mutable(value.rendered[0]!.routes[0]!).prohibitedPatterns = ['generic equal card grid'];
      }
    ],
    [
      'preview_isolation',
      (value) => {
        mutable(value.preview).separateOrigin = false;
      }
    ],
    [
      'last_known_good_behavior',
      (value) => {
        mutable(value.lastKnownGood).activeBuildId = 'build:2';
      }
    ]
  ];
  assert.deepEqual(
    cases.map(([id]) => id),
    PHASE3_BENCHMARK_DIMENSIONS
  );
  for (const [id, mutate] of cases) {
    const value = structuredClone(fixture());
    mutate(value);
    const report = evaluatePhase3Benchmark(value);
    assert.equal(report.dimensions.find((item) => item.dimension === id)?.status, 'fail', id);
    assert.equal(report.passed, false, id);
  }
});
