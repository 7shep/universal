import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConceptCandidate, ConceptDevelopmentProvider } from './concept-director-contracts.ts';
import {
  assertMeaningfulConceptDifferentiation,
  developConceptDirection,
  getDifferingConceptDimensions,
  selectConceptDirection
} from './concept-director.ts';
import { DeterministicOfflineConceptProvider } from './concept-director-offline-provider.ts';
import type { CreativeBrief, DiscoverySession, PageMap } from './discovery-contracts.ts';
import {
  answerDiscoveryQuestion,
  approveDiscoveryBrief,
  requestDiscoveryApproval,
  setDiscoveryPageMap,
  startDiscoverySession
} from './discovery-session.ts';

const pageMap: PageMap = {
  kind: 'single-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Release planning',
      userGoal: 'Understand the calmer release workflow and start a trial.',
      primaryMessage: 'A calmer way for release managers to plan launches.',
      requiredSections: ['opening', 'workflow', 'proof', 'trial action'],
      requiredContent: ['release workflow', 'customer evidence', 'trial invitation'],
      primaryAction: 'Start a trial',
      secondaryActions: ['Read the release guide'],
      navigationRelationship: 'Section anchors on the single route.',
      uniqueResponsibility: 'Explain the workflow and convert qualified teams.',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['release workflow narrative']
    }
  ]
};

function respond(
  session: DiscoverySession,
  topic: 'purpose' | 'audience' | 'page-content',
  summary: string
): DiscoverySession {
  return answerDiscoveryQuestion(session, {
    questionId: `discovery:${topic}`,
    topic,
    mode: 'exact',
    value: { summary },
    answeredAt: '2026-07-28T10:01:00.000Z'
  });
}

function approvedBrief(): CreativeBrief {
  let session = startDiscoverySession({
    id: 'concept-director',
    prompt: 'A release planning product site for release managers.',
    now: '2026-07-28T10:00:00.000Z'
  });
  session = respond(session, 'purpose', 'Convert qualified release managers to product trials.');
  session = respond(session, 'audience', 'Release managers at small product teams.');
  session = setDiscoveryPageMap(session, pageMap, {
    now: '2026-07-28T10:02:00.000Z',
    source: 'user',
    evidence: 'The user approved a focused single-page site.'
  });
  session = respond(
    session,
    'page-content',
    'Opening promise, release workflow, customer proof, and trial invitation.'
  );
  session = requestDiscoveryApproval(session, '2026-07-28T10:03:00.000Z');
  session = approveDiscoveryBrief(session, '2026-07-28T10:04:00.000Z', 'alex');
  return session.brief!;
}

async function offlineCandidates(brief = approvedBrief()): Promise<readonly ConceptCandidate[]> {
  const output = (await new DeterministicOfflineConceptProvider().developConcepts({
    brief,
    candidateCount: 3
  })) as { candidates: readonly ConceptCandidate[] };
  return output.candidates;
}

function providerFor(candidates: readonly unknown[]): ConceptDevelopmentProvider {
  return {
    async developConcepts() {
      return { candidates };
    }
  };
}

function tiedCandidates(brief: CreativeBrief): readonly ConceptCandidate[] {
  const names = [
    [
      'Atlas',
      'ledger record audit chronology',
      'rail ledger baseline scaffold',
      'wayfinder index register marker',
      'archival formal engraved stately',
      'documentary workplace portrait evidence',
      'measured reveal confirm advance',
      'collapse compress sequence preserve'
    ],
    [
      'Beacon',
      'journey quest discovery passage',
      'stage theater panorama spotlight',
      'compass trail route orientation',
      'humanist friendly rounded conversational',
      'diagrammatic schematic technical explanatory',
      'direct manipulate respond reverse',
      'reflow reorder adapt transform'
    ],
    [
      'Cairn',
      'argument thesis rebuttal conclusion',
      'field canvas horizon cluster',
      'landmark beacon territory destination',
      'editorial literary expressive dramatic',
      'observational environmental tactile atmospheric',
      'guided unfold pause continue',
      'stack crop condense prioritize'
    ]
  ] as const;
  return names.map(
    ([
      title,
      narrative,
      composition,
      navigation,
      typography,
      imagery,
      interaction,
      responsive
    ]) => ({
      id: `concept-${title.toLowerCase()}`,
      title,
      centralIdea: `${title} ${narrative} ${composition} converts release managers through calm evidence and product trials.`,
      narrativeStructure: `${narrative} problem sequence moves through proof, outcome, and chapter decisions.`,
      composition: `${composition} grid establishes hierarchy, rhythm, scale, and space.`,
      navigationPhilosophy: `${navigation} routes visitors through named release decisions and visible actions.`,
      typographyIntent: `${typography} serif and sans typeface roles use deliberate scale, measure, and weight.`,
      imageryIntent: `${imagery} photography and diagram subjects use deliberate crop, lighting, and caption.`,
      interactionPhilosophy: `${interaction} interaction gives explicit feedback with reversible actions.`,
      responsiveBehavior: `${responsive} mobile containers reflow to stack in reading order with touch targets.`,
      accessibilityIntent:
        'Semantic reading order, keyboard focus, strong contrast, and reduced motion support every visitor.',
      briefAlignment: [
        brief.content.purpose.summary,
        brief.content.audience.summary,
        brief.content.pageContent.summary
      ],
      strengths: ['Clear release story'],
      weaknesses: ['Requires focused editing'],
      risks: ['Evidence quality must remain high'],
      rejectedDefaults: ['Decorative novelty']
    })
  );
}

test('offline development produces three meaningfully differentiated concepts', async () => {
  const brief = approvedBrief();
  const first = await developConceptDirection(brief, new DeterministicOfflineConceptProvider());
  const second = await developConceptDirection(brief, new DeterministicOfflineConceptProvider());
  assert.equal(first.candidates.length, 3);
  assert.deepEqual(first, second);
  for (let index = 0; index < first.candidates.length - 1; index += 1) {
    assert.ok(
      getDifferingConceptDimensions(first.candidates[index]!, first.candidates[index + 1]!)
        .length >= 4
    );
  }
  assert.ok(first.candidates.some((candidate) => candidate.id === first.recommendedCandidateId));
  assert.equal(first.evaluations.length, 3);
});

test('palette-only and minor stylistic variants are rejected', async () => {
  const [candidate] = await offlineCandidates();
  const variants = ['amber', 'blue', 'green'].map((palette, index) => ({
    ...candidate!,
    id: `palette-${index}`,
    title: `${candidate!.title} in ${palette}`,
    imageryIntent: `${candidate!.imageryIntent} The accent palette is ${palette}.`
  }));
  assert.throws(
    () => assertMeaningfulConceptDifferentiation(variants),
    /minor stylistic variants/i
  );
});

test('malformed provider output is rejected before scoring', async () => {
  const malformed: ConceptDevelopmentProvider = {
    async developConcepts() {
      return {
        candidates: [{ id: 'incomplete' }, { id: 'also-incomplete' }, { id: 'still-incomplete' }],
        scores: [10, 10, 10]
      };
    }
  };
  await assert.rejects(
    () => developConceptDirection(approvedBrief(), malformed),
    /candidate 1\.title must be a non-empty string/i
  );
});

test('selection is deterministic and provider-authored scores are ignored', async () => {
  const brief = approvedBrief();
  const candidates = await offlineCandidates(brief);
  const poisoned = candidates.map((candidate, index) => ({
    ...candidate,
    providerScore: index === 2 ? 1_000_000 : -1_000_000
  }));
  const clean = await developConceptDirection(brief, providerFor(candidates));
  const untrusted = await developConceptDirection(brief, providerFor(poisoned));
  assert.equal(clean.recommendedCandidateId, untrusted.recommendedCandidateId);
  assert.deepEqual(clean.evaluations, untrusted.evaluations);
});

test('tied scores use candidate id as the final deterministic tie-breaker', () => {
  const brief = approvedBrief();
  const result = selectConceptDirection(brief, tiedCandidates(brief));
  const totals = result.evaluations.map((evaluation) => evaluation.totalScore);
  assert.equal(new Set(totals).size, 1);
  assert.equal(result.recommendedCandidateId, 'concept-atlas');
});

test('generic AI patterns receive engine-owned penalties', async () => {
  const brief = approvedBrief();
  const candidates = [...(await offlineCandidates(brief))];
  candidates[0] = {
    ...candidates[0]!,
    composition:
      'A clean modern bento grid of floating cards uses gradient borders and a generic SaaS dashboard mockup.'
  };
  const result = selectConceptDirection(brief, candidates);
  const penalized = result.evaluations.find(
    (evaluation) => evaluation.candidateId === candidates[0]!.id
  )!;
  const peer = result.evaluations.find(
    (evaluation) => evaluation.candidateId === candidates[1]!.id
  )!;
  assert.ok(
    penalized.criteria.genericPatternResistance.score < peer.criteria.genericPatternResistance.score
  );
});

test('candidates that miss the approved brief are disqualified', () => {
  const brief = approvedBrief();
  const candidates = tiedCandidates(brief).map((candidate, index) => ({
    ...candidate,
    centralIdea: `${candidate.title} ${candidate.composition} museum catalogue for ancient marine fossils ${index}.`,
    briefAlignment: ['Museum curators', 'Catalogue fossil specimens']
  }));
  assert.throws(
    () => selectConceptDirection(brief, candidates),
    /no concept candidate satisfies brief-fit/i
  );
});

test('an explicit accessibility risk disqualifies a candidate', async () => {
  const brief = approvedBrief();
  const candidates = [...(await offlineCandidates(brief))];
  candidates[0] = {
    ...candidates[0]!,
    accessibilityIntent:
      'Use low contrast tiny text, hover only navigation, autoplay motion, and color alone for status.'
  };
  const result = selectConceptDirection(brief, candidates);
  const risky = result.evaluations.find(
    (evaluation) => evaluation.candidateId === candidates[0]!.id
  )!;
  assert.equal(risky.eligible, false);
  assert.match(risky.disqualifications.join(' '), /accessibility/i);
  assert.notEqual(result.recommendedCandidateId, risky.candidateId);
});

test('stale brief approval is rejected before provider invocation', async () => {
  const brief = approvedBrief();
  let calls = 0;
  const provider: ConceptDevelopmentProvider = {
    async developConcepts() {
      calls += 1;
      return { candidates: [] };
    }
  };
  const stale = {
    ...brief,
    approval: { ...brief.approval, approvedDigest: 'discovery-v1-stale' }
  } as CreativeBrief;
  await assert.rejects(
    () => developConceptDirection(stale, provider),
    /digest-valid creative brief/i
  );
  assert.equal(calls, 0);
});
