/* Dynamic/string-keyed lookup: a naive "no direct JSX usage found" search would miss this. */
import { LegacyBadge } from './legacyBadge';

export const componentRegistry: Record<string, unknown> = {
  legacyBadge: LegacyBadge
};
