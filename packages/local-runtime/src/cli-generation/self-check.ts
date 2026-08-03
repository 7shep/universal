// Runs the real build gate against the provider's own output, before the runtime
// has spent thirty seconds installing dependencies and running a production build
// only to reject the result.
//
// This deliberately calls `reviewGeneratedImplementation` rather than
// reimplementing its predicates. An independent copy would drift, and the checks
// that actually reject generated work are the ARCH_* findings from
// `analyzeReactArchitecture`, which no regex reimplementation would cover.
import { validateProviderProject, type ProjectGenerationRequest } from '@universal/generation';
import { reviewGeneratedImplementation } from '../review.ts';

// The review record's timestamp is discarded here, so pinning it keeps this
// function pure and its tests free of a clock.
const FIXED_REVIEW_TIME = '1970-01-01T00:00:00.000Z';

/**
 * Returns one human-readable gap per failed check, ready to paste into a repair
 * prompt. An empty array means the output would pass the gate as it stands.
 */
export function selfCheck(raw: unknown, request: ProjectGenerationRequest): readonly string[] {
  const project = validateProviderProject(raw, request);
  // A structural rejection stops the review from running at all, so it is
  // reported on its own: there is nothing further to check until it is fixed.
  if (!project.ok) return [`${project.error.code} at ${project.error.path}: ${project.error.message}`];
  return reviewGeneratedImplementation(project.value, request, FIXED_REVIEW_TIME)
    .checks.filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.message}`);
}
