import type { CreativeBrief } from './discovery-contracts.ts';

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
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

export function digestCreativeBrief(
  brief: Pick<CreativeBrief, 'contractVersion' | 'id' | 'version' | 'content' | 'decisions'>
): string {
  return `discovery-v1-${fnv1a(
    canonicalize({
      contractVersion: brief.contractVersion,
      id: brief.id,
      version: brief.version,
      content: brief.content,
      decisions: brief.decisions
    })
  )}`;
}
