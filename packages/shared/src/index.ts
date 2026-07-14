export type Brand = string & { readonly __brand: unique symbol };

export interface Identifiable {
  id: string;
}

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Context supplied by a user before a design direction is selected. */
export interface DesignBrief {
  prompt: string;
  audience?: string | undefined;
  constraints?: readonly string[] | undefined;
  references?: readonly DesignReference[] | undefined;
}

/** A reference that informs, or deliberately rejects, a visual direction. */
export interface DesignReference {
  url?: string | undefined;
  description: string;
  role: 'inspiration' | 'anti-reference';
}

/** A file emitted by a generated project or reviewed as implementation evidence. */
export interface ProjectFile {
  path: string;
  content: string;
}

/** A self-contained project artifact produced from a design plan. */
export interface GeneratedProject {
  files: readonly ProjectFile[];
  entrypoint: string;
  framework: 'react-vite';
}

/** Severity assigned to an actionable design review finding. */
export type ReviewSeverity = 'info' | 'warning' | 'error';

/** A single rule result from automated design review. */
export interface ReviewFinding {
  severity: ReviewSeverity;
  rule: string;
  message: string;
  suggestion: string;
}

/** Aggregate result returned by automated design review. */
export interface ReviewResult {
  status: 'pass' | 'revision_recommended';
  score: number;
  findings: readonly ReviewFinding[];
  passedRules: readonly string[];
}
