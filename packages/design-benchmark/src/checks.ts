import { serializeDeterministically, sha256 } from './deterministic.ts';

export interface RawCheckResult {
  readonly exitStatus: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ExecutedCheckResult extends RawCheckResult {
  readonly name: string;
  readonly outputDigest: string;
}

const normalizeLf = (value: string): string => value.replace(/\r\n?/g, '\n');

export function recordExecutedCheck(name: string, result: RawCheckResult): ExecutedCheckResult {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Executed check name is required.');
  if (!Number.isInteger(result.exitStatus))
    throw new Error(`Check "${normalizedName}" must return an integer exit status.`);
  const stdout = normalizeLf(result.stdout);
  const stderr = normalizeLf(result.stderr);
  return {
    name: normalizedName,
    exitStatus: result.exitStatus,
    stdout,
    stderr,
    outputDigest: sha256(
      serializeDeterministically(
        { name: normalizedName, exitStatus: result.exitStatus, stdout, stderr },
        0
      )
    )
  };
}

export function assertSuccessfulRequiredChecks(
  requiredNames: readonly string[],
  results: readonly ExecutedCheckResult[]
): void {
  const byName = new Map<string, ExecutedCheckResult>();
  for (const result of results) {
    if (byName.has(result.name))
      throw new Error(`Duplicate executed check result: ${result.name}.`);
    const canonical = recordExecutedCheck(result.name, result);
    if (
      canonical.outputDigest !== result.outputDigest ||
      canonical.name !== result.name ||
      canonical.stdout !== result.stdout ||
      canonical.stderr !== result.stderr
    )
      throw new Error(
        `Executed check "${result.name}" is not canonical or has an invalid output digest.`
      );
    byName.set(result.name, result);
  }
  for (const name of requiredNames) {
    const result = byName.get(name);
    if (!result) throw new Error(`Required evidence check was not executed: ${name}.`);
    if (result.exitStatus !== 0)
      throw new Error(`Required evidence check failed (${result.exitStatus}): ${name}.`);
  }
}
