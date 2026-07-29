import { lstat, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  BuildRecord,
  ProjectRecord,
  RevisionRecord,
  RuntimeOperation
} from '@universal/runtime-contracts';
import { normalizeManifestPath } from './workspace.ts';

export interface RevisionRetentionPolicy {
  retainCount?: number;
  minAgeMs?: number;
}
export interface RevisionRetentionInput {
  workspaceRoot: string;
  now: string | Date;
  policy: RevisionRetentionPolicy;
  revisions: readonly RevisionRecord[];
  projects: readonly ProjectRecord[];
  builds: readonly BuildRecord[];
  operations: readonly RuntimeOperation[];
  activePreviewRevisionIds: readonly string[];
  pinnedRevisionIds?: readonly string[];
}
export type RevisionRetentionStateLock = <T>(
  work: (state: RevisionRetentionInput) => Promise<T>
) => Promise<T>;
export type RevisionRetentionReason =
  | 'newest-successful'
  | 'current-revision'
  | 'active-operation'
  | 'active-build'
  | 'active-preview'
  | 'pinned'
  | 'retained-count'
  | 'too-new'
  | 'missing-directory'
  | 'unsafe-path'
  | 'invalid-created-at';
export interface RevisionRetentionEntry {
  projectId: string;
  revisionId: string;
  workspacePath: string;
  reason?: RevisionRetentionReason;
}
export interface RevisionRetentionPlan {
  workspaceRoot: string;
  eligible: readonly RevisionRetentionEntry[];
  retained: readonly RevisionRetentionEntry[];
  skipped: readonly RevisionRetentionEntry[];
}
export interface RevisionRetentionResult extends RevisionRetentionPlan {
  dryRun: boolean;
  removed: readonly RevisionRetentionEntry[];
  failed: readonly (RevisionRetentionEntry & { error: string })[];
}

const active = (s: string) => !['ready', 'failed', 'cancelled', 'interrupted'].includes(s);
const inside = (root: string, target: string) => {
  const r = path.relative(root, target);
  return r !== '' && r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r);
};
const samePath = (left: string, right: string) => path.relative(left, right) === '';
const segment = (v: string) => {
  const x = normalizeManifestPath(v).replaceAll(':', '_');
  if (x.includes('/')) throw new Error('Revision ids may not contain path separators.');
  return x;
};
const time = (v: string) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
};
function validate(p: RevisionRetentionPolicy) {
  if (p.retainCount === undefined && p.minAgeMs === undefined)
    throw new Error('Revision retention requires retainCount and/or minAgeMs.');
  if (p.retainCount !== undefined && (!Number.isSafeInteger(p.retainCount) || p.retainCount < 0))
    throw new Error('retainCount must be a non-negative safe integer.');
  if (p.minAgeMs !== undefined && (!Number.isFinite(p.minAgeMs) || p.minAgeMs < 0))
    throw new Error('minAgeMs must be a non-negative finite number.');
}
function pins(i: RevisionRetentionInput) {
  const out = new Map<string, RevisionRetentionReason>(),
    put = (id: string | undefined, why: RevisionRetentionReason) => {
      if (id) out.set(id, why);
    };
  for (const p of i.projects) put(p.currentRevisionId, 'current-revision');
  for (const p of i.projects)
    put(i.builds.find((b) => b.id === p.latestSuccessfulBuildId)?.revisionId, 'newest-successful');
  for (const o of i.operations) if (active(o.status)) put(o.revisionId, 'active-operation');
  for (const b of i.builds) if (active(b.status)) put(b.revisionId, 'active-build');
  for (const id of i.activePreviewRevisionIds ?? []) put(id, 'active-preview');
  for (const id of i.pinnedRevisionIds ?? []) put(id, 'pinned');
  return out;
}
const sort = (x: readonly RevisionRecord[]) =>
  [...x].sort(
    (a, b) =>
      (time(b.createdAt) ?? -Infinity) - (time(a.createdAt) ?? -Infinity) ||
      b.number - a.number ||
      a.id.localeCompare(b.id)
  );
/** Creates an inspectable plan and never mutates the filesystem. */
export async function planRevisionRetention(
  i: RevisionRetentionInput
): Promise<RevisionRetentionPlan> {
  validate(i.policy);
  const now = i.now instanceof Date ? i.now.getTime() : time(i.now);
  if (now === undefined) throw new Error('now must be a valid timestamp.');
  const root = path.resolve(i.workspaceRoot),
    pinned = pins(i),
    retained: RevisionRetentionEntry[] = [],
    eligible: RevisionRetentionEntry[] = [],
    skipped: RevisionRetentionEntry[] = [];
  for (const projectId of new Set(i.revisions.map((r) => r.projectId)))
    for (const [n, r] of sort(i.revisions.filter((x) => x.projectId === projectId)).entries()) {
      const e = { projectId: r.projectId, revisionId: r.id, workspacePath: r.workspacePath };
      let target: string;
      try {
        target = path.resolve(root, 'projects', segment(r.projectId), 'revisions', segment(r.id));
      } catch {
        skipped.push({ ...e, reason: 'unsafe-path' });
        continue;
      }
      if (path.resolve(r.workspacePath) !== target) {
        skipped.push({ ...e, reason: 'unsafe-path' });
        continue;
      }
      const why = pinned.get(r.id);
      if (why) {
        retained.push({ ...e, reason: why });
        continue;
      }
      const created = time(r.createdAt);
      if (created === undefined) {
        skipped.push({ ...e, reason: 'invalid-created-at' });
        continue;
      }
      if (i.policy.retainCount !== undefined && n < i.policy.retainCount) {
        retained.push({ ...e, reason: 'retained-count' });
        continue;
      }
      if (i.policy.minAgeMs !== undefined && now - created < i.policy.minAgeMs) {
        retained.push({ ...e, reason: 'too-new' });
        continue;
      }
      try {
        const info = await lstat(target);
        if (info.isDirectory() && !info.isSymbolicLink()) eligible.push(e);
        else skipped.push({ ...e, reason: 'unsafe-path' });
      } catch (error) {
        skipped.push({
          ...e,
          reason:
            (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing-directory' : 'unsafe-path'
        });
      }
    }
  return { workspaceRoot: root, eligible, retained, skipped };
}
async function safeDelete(root: string, e: RevisionRetentionEntry) {
  const rootReal = await realpath(root),
    target = path.resolve(e.workspacePath),
    parent = path.dirname(target),
    parentReal = await realpath(parent),
    expectedReal = path.join(parentReal, path.basename(target));
  if (!inside(rootReal, parentReal) || !inside(parentReal, expectedReal))
    throw new Error('Revision target escaped the runtime workspace.');
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('Revision target is not a regular directory.');
  const real = await realpath(target);
  if (!samePath(real, expectedReal) || !inside(parentReal, real))
    throw new Error('Revision target resolved through a link or outside its revision directory.');
  await rm(real, { recursive: true, force: false });
}
/** Applies retention while the authoritative runtime mutation boundary is held. */
export async function executeRevisionRetention(
  withExclusiveState: RevisionRetentionStateLock,
  options: { dryRun?: boolean; remove?: (entry: RevisionRetentionEntry) => Promise<void> } = {}
): Promise<RevisionRetentionResult> {
  return withExclusiveState(async (state) => {
    const plan = await planRevisionRetention(state);
    if (options.dryRun) return { ...plan, dryRun: true, removed: [], failed: [] };
    const removed: RevisionRetentionEntry[] = [],
      failed: (RevisionRetentionEntry & { error: string })[] = [];
    for (const entry of plan.eligible)
      try {
        await (options.remove ? options.remove(entry) : safeDelete(plan.workspaceRoot, entry));
        removed.push(entry);
      } catch (error) {
        failed.push({ ...entry, error: error instanceof Error ? error.message : String(error) });
      }
    return { ...plan, dryRun: false, removed, failed };
  });
} /** Plans then optionally applies retention. Dry-run is the default. */
export async function retainRevisions(
  withExclusiveState: RevisionRetentionStateLock,
  options: { dryRun?: boolean } = {}
): Promise<RevisionRetentionResult> {
  return executeRevisionRetention(withExclusiveState, {
    dryRun: options.dryRun ?? true
  });
}
