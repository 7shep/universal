import type { CreativeBrief, DecisionProvenance } from './discovery-contracts.ts';
import { digestCreativeBrief } from './creative-brief.ts';
import { validateCreativeBrief } from './discovery-validation.ts';
import {
  DESIGN_PLAN_V2_VERSION,
  type DesignPlanV2,
  type DesignPlanV2Draft,
  type PlanDecisionProvenance,
  type SelectedDirectionEvaluation
} from './design-plan-v2-contracts.ts';
import { digestDesignPlanV2 } from './design-plan-v2-digests.ts';
import {
  parseDesignPlanV2Draft,
  validateDesignPlanV2,
  validateSelectedDirectionEvaluation
} from './design-plan-v2-validation.ts';

export type DesignPlanV2CompilerErrorCode =
  | 'invalid-brief'
  | 'unapproved-brief'
  | 'stale-approval'
  | 'invalid-evaluation'
  | 'stale-evaluation'
  | 'invalid-provider-output'
  | 'invalid-provenance'
  | 'direction-mismatch'
  | 'invalid-plan';

export class DesignPlanV2CompilerError extends Error {
  readonly code: DesignPlanV2CompilerErrorCode;
  readonly path: string;

  constructor(code: DesignPlanV2CompilerErrorCode, path: string, message: string) {
    super(message);
    this.name = 'DesignPlanV2CompilerError';
    this.code = code;
    this.path = path;
  }
}

export interface CompileDesignPlanV2Input {
  brief: CreativeBrief;
  evaluation: SelectedDirectionEvaluation;
  /** Raw provider JSON. It is parsed and strictly validated before use. */
  providerOutput: string;
  now: string;
  id?: string | undefined;
}

function fail(code: DesignPlanV2CompilerErrorCode, path: string, message: string): never {
  throw new DesignPlanV2CompilerError(code, path, message);
}

function assertApprovedBrief(brief: CreativeBrief): string {
  if (brief.approval.status !== 'approved')
    fail('unapproved-brief', 'approval.status', 'Design Plan compilation requires approval.');
  const computed = digestCreativeBrief(brief);
  if (computed !== brief.digest)
    fail('stale-approval', 'digest', 'Creative brief content has changed since digesting.');
  if (brief.approval.approvedDigest !== computed)
    fail(
      'stale-approval',
      'approval.approvedDigest',
      'Creative brief approval does not cover the current content.'
    );
  const validation = validateCreativeBrief(brief);
  if (!validation.ok)
    fail(
      'invalid-brief',
      validation.error.path,
      `Creative brief is malformed: ${validation.error.message}`
    );
  if (brief.unresolved.some((item) => item.blocksApproval))
    fail('stale-approval', 'unresolved', 'Approved brief contains an unresolved approval blocker.');
  const lastRevision = brief.revisions.at(-1);
  if (lastRevision && lastRevision.version === brief.version && lastRevision.digest !== computed)
    fail(
      'stale-approval',
      'revisions',
      'Latest brief revision does not match the approved digest.'
    );
  return computed;
}

function assertEvaluation(
  evaluation: SelectedDirectionEvaluation,
  brief: CreativeBrief,
  briefDigest: string
): void {
  const validation = validateSelectedDirectionEvaluation(evaluation);
  if (!validation.ok)
    fail(
      'invalid-evaluation',
      validation.error.path,
      `Selected-direction evaluation is invalid: ${validation.error.message}`
    );
  if (
    evaluation.briefId !== brief.id ||
    evaluation.briefVersion !== brief.version ||
    evaluation.briefDigest !== briefDigest
  )
    fail(
      'stale-evaluation',
      'evaluation.briefDigest',
      'Direction evaluation is not bound to this approved brief revision.'
    );
}

function matchingBriefDecision(
  brief: CreativeBrief,
  source: PlanDecisionProvenance
): DecisionProvenance | undefined {
  return brief.decisions.find((decision) => decision.id === source.sourceId);
}

function assertProvenanceTrust(
  draft: DesignPlanV2Draft,
  brief: CreativeBrief,
  evaluation: SelectedDirectionEvaluation
): void {
  for (const [index, source] of draft.decisionProvenance.entries()) {
    const path = `decisionProvenance.${index}.sourceId`;
    const decision = matchingBriefDecision(brief, source);
    if (source.sourceKind === 'user-decision') {
      if (
        !decision ||
        decision.source !== 'user' ||
        decision.requiresConfirmation ||
        !['explicit', 'preferred'].includes(decision.disposition)
      )
        fail(
          'invalid-provenance',
          path,
          'User-decision provenance must reference a confirmed explicit or preferred user decision in the brief.'
        );
    } else if (source.sourceKind === 'supplied-evidence') {
      const referenceMatch = /^brief-reference:(\d+)$/.exec(source.sourceId);
      const referenceIndex = referenceMatch ? Number(referenceMatch[1]) : -1;
      const trustedDecision =
        decision &&
        ['user', 'repository'].includes(decision.source) &&
        ['explicit', 'preferred'].includes(decision.disposition) &&
        !decision.requiresConfirmation;
      if (
        !trustedDecision &&
        (referenceIndex < 0 || referenceIndex >= brief.content.references.length)
      )
        fail(
          'invalid-provenance',
          path,
          'Supplied evidence must reference confirmed user/repository evidence or brief-reference:<index>.'
        );
    } else if (source.sourceKind === 'approved-assumption') {
      if (
        !decision ||
        !['assumed', 'delegated', 'drafted'].includes(decision.disposition) ||
        decision.requiresConfirmation
      )
        fail(
          'invalid-provenance',
          path,
          'Approved assumptions must reference a confirmed brief assumption or delegation.'
        );
    } else if (
      source.sourceKind === 'universal-recommendation' &&
      source.sourceId !== evaluation.selectedDirection.id
    ) {
      fail(
        'invalid-provenance',
        path,
        'Universal recommendations must reference the digest-bound selected direction.'
      );
    }
  }
}

export function compileDesignPlanV2(input: CompileDesignPlanV2Input): DesignPlanV2 {
  const briefDigest = assertApprovedBrief(input.brief);
  assertEvaluation(input.evaluation, input.brief, briefDigest);
  const provider = parseDesignPlanV2Draft(input.providerOutput);
  if (!provider.ok)
    fail(
      'invalid-provider-output',
      provider.error.path,
      `Provider output is invalid: ${provider.error.message}`
    );
  const draft = provider.value;
  assertProvenanceTrust(draft, input.brief, input.evaluation);
  if (draft.conceptSpine.value !== input.evaluation.selectedDirection.conceptSpine)
    fail(
      'direction-mismatch',
      'conceptSpine.value',
      'Provider changed the selected direction concept spine.'
    );
  if (draft.emotionalObjective.value !== input.evaluation.selectedDirection.emotionalObjective)
    fail(
      'direction-mismatch',
      'emotionalObjective.value',
      'Provider changed the selected direction emotional objective.'
    );

  const unsigned: Omit<DesignPlanV2, 'digest'> = {
    contractVersion: DESIGN_PLAN_V2_VERSION,
    id: input.id ?? `design-plan:${input.brief.id}:v${input.brief.version}`,
    compiledAt: input.now,
    source: {
      briefId: input.brief.id,
      briefVersion: input.brief.version,
      briefDigest,
      approvedDigest: input.brief.approval.approvedDigest!,
      evaluationId: input.evaluation.id,
      evaluationDigest: input.evaluation.digest,
      directionId: input.evaluation.selectedDirection.id
    },
    pageMap: input.brief.content.pageMap,
    ...draft
  };
  const plan: DesignPlanV2 = { ...unsigned, digest: digestDesignPlanV2(unsigned) };
  const validation = validateDesignPlanV2(plan);
  if (!validation.ok)
    fail(
      'invalid-plan',
      validation.error.path,
      `Compiled Design Plan is invalid: ${validation.error.message}`
    );
  return plan;
}
