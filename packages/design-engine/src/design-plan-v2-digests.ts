import type { DesignPlanV2, SelectedDirectionEvaluation } from './design-plan-v2-contracts.ts';

export function canonicalizeDesignValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeDesignValue).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeDesignValue(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function digest(prefix: string, value: unknown): string {
  return `${prefix}-${fnv1a(canonicalizeDesignValue(value))}`;
}

export function digestDirectionEvaluation(
  evaluation: Omit<SelectedDirectionEvaluation, 'digest'>
): string {
  return digest('direction-evaluation-v1', evaluation);
}

export function digestDesignPlanV2(plan: Omit<DesignPlanV2, 'digest'>): string {
  return digest('design-plan-v2', plan);
}
