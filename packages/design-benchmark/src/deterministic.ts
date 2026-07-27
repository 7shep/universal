import { createHash } from 'node:crypto';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function canonicalize(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Cannot serialize a non-finite number deterministically.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
  if (typeof value !== 'object')
    throw new TypeError(`Cannot serialize value of type ${typeof value}.`);
  if (seen.has(value)) throw new TypeError('Cannot serialize a cyclic value.');

  seen.add(value);
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort(compareText)) {
    const item = record[key];
    if (item !== undefined) result[key] = canonicalize(item, seen);
  }
  seen.delete(value);
  return result;
}

/** JSON with stable object-key ordering, finite-number validation, and a trailing newline. */
export function serializeDeterministically(value: unknown, indentation = 2): string {
  if (!Number.isInteger(indentation) || indentation < 0 || indentation > 10)
    throw new RangeError('indentation must be an integer from 0 through 10.');
  return `${JSON.stringify(canonicalize(value, new Set()), null, indentation)}\n`;
}

/** Sort text identifiers without locale- or host-dependent collation. */
export function compareIdentifiers(left: string, right: string): number {
  return compareText(left, right);
}

/** Round report arithmetic so repeated runs cannot accumulate floating-point noise. */
export function roundScore(value: number, precision = 6): number {
  if (!Number.isFinite(value)) throw new TypeError('Score must be finite.');
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
