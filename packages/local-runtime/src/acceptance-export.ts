import { createHash, randomUUID } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { RuntimeFailure } from './errors.ts';

export const EXPORT_WORKFLOW_VERSION = '1.0.0' as const;

export interface RevisionProvenance {
  projectId: string;
  revisionId: string;
  designPlanId: string;
  designPlanDigest: string;
  generatedProjectDigest: string;
  reviewEvidence: readonly { id: string; digest: string }[];
  createdAt: string;
  sourceRoot: string;
}

export interface AcceptanceRecord {
  version: typeof EXPORT_WORKFLOW_VERSION;
  id: string;
  projectId: string;
  revisionId: string;
  acceptedBy: string;
  acceptedAt: string;
  evidenceDigest: string;
  provenance: Omit<RevisionProvenance, 'sourceRoot'>;
}

export interface ExportRecord {
  version: typeof EXPORT_WORKFLOW_VERSION;
  id: string;
  acceptanceId: string;
  projectId: string;
  revisionId: string;
  destination: string;
  exportedAt: string;
  manifestDigest: string;
}

export interface AcceptanceExportOptions {
  metadataRoot: string;
  allowedRoots: readonly string[];
  now?: () => string;
  createId?: () => string;
  beforeCommit?: (stagingPath: string) => Promise<void>;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function portableProvenance(value: RevisionProvenance): Omit<RevisionProvenance, 'sourceRoot'> {
  return {
    projectId: value.projectId,
    revisionId: value.revisionId,
    designPlanId: value.designPlanId,
    designPlanDigest: value.designPlanDigest,
    generatedProjectDigest: value.generatedProjectDigest,
    reviewEvidence: value.reviewEvidence,
    createdAt: value.createdAt
  };
}

async function verifySourceProvenance(value: RevisionProvenance): Promise<string> {
  const source = await realpath(value.sourceRoot);
  if (!(await stat(source)).isDirectory())
    throw new RuntimeFailure('INVALID_REQUEST', 'Revision source is not a directory.');
  let manifest: unknown;
  try {
    manifest = JSON.parse(
      await readFile(path.join(source, '.universal-manifest.json'), 'utf8')
    ) as unknown;
  } catch {
    throw new RuntimeFailure(
      'STALE_ARTIFACT',
      'Revision source is missing its trusted immutable manifest.'
    );
  }
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('manifestDigest' in manifest) ||
    manifest.manifestDigest !== value.generatedProjectDigest
  )
    throw new RuntimeFailure(
      'STALE_ARTIFACT',
      'Revision source manifest does not match the accepted generated-project digest.'
    );
  return source;
}

function contained(root: string, target: string, allowEqual = false): boolean {
  const relative = path.relative(root, target);
  return (
    (allowEqual && relative === '') ||
    (relative !== '' &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function rejectSymlinkAncestors(root: string, target: string): Promise<void> {
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new RuntimeFailure(
          'MATERIALIZATION_FAILURE',
          `Export path contains a symlink or junction: ${current}`
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return;
    }
  }
}

async function collectPortablePaths(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new RuntimeFailure(
        'MATERIALIZATION_FAILURE',
        `Accepted revision contains a forbidden symlink: ${child}`
      );
    if (entry.isDirectory()) result.push(...(await collectPortablePaths(root, child)));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

export class AcceptanceExportService {
  private readonly metadataRoot: string;
  private readonly allowedRoots: readonly string[];
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly beforeCommit?: ((stagingPath: string) => Promise<void>) | undefined;

  constructor(options: AcceptanceExportOptions) {
    this.metadataRoot = path.resolve(options.metadataRoot);
    this.allowedRoots = options.allowedRoots.map((item) => path.resolve(item));
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? randomUUID;
    this.beforeCommit = options.beforeCommit;
  }

  async accept(
    provenance: RevisionProvenance,
    authorization: { acceptedBy: string; confirmation: true }
  ): Promise<AcceptanceRecord> {
    if (!authorization.confirmation || !authorization.acceptedBy.trim())
      throw new RuntimeFailure(
        'UNAUTHORIZED_REQUEST',
        'Explicit user identity and confirmation are required to accept a revision.'
      );
    await verifySourceProvenance(provenance);
    const portable = portableProvenance(provenance);
    const record: AcceptanceRecord = {
      version: EXPORT_WORKFLOW_VERSION,
      id: `acceptance:${this.createId()}`,
      projectId: provenance.projectId,
      revisionId: provenance.revisionId,
      acceptedBy: authorization.acceptedBy.trim(),
      acceptedAt: this.now(),
      evidenceDigest: digest(portable.reviewEvidence),
      provenance: portable
    };
    await mkdir(path.join(this.metadataRoot, 'acceptances'), { recursive: true });
    const target = path.join(
      this.metadataRoot,
      'acceptances',
      `${record.id.replaceAll(':', '_')}.json`
    );
    await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    return record;
  }

  async acceptedRevisionIds(): Promise<readonly string[]> {
    const directory = path.join(this.metadataRoot, 'acceptances');
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const revisions = new Set<string>();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const value: unknown = JSON.parse(await readFile(path.join(directory, entry.name), 'utf8'));
      if (
        typeof value === 'object' &&
        value !== null &&
        'revisionId' in value &&
        typeof value.revisionId === 'string'
      )
        revisions.add(value.revisionId);
    }
    return [...revisions].sort();
  }
  async export(input: {
    acceptance: AcceptanceRecord;
    provenance: RevisionProvenance;
    destination: string;
    authorization: { requestedBy: string; confirmation: true };
  }): Promise<ExportRecord> {
    if (!input.authorization.confirmation || !input.authorization.requestedBy.trim())
      throw new RuntimeFailure(
        'UNAUTHORIZED_REQUEST',
        'Export is a separate user-authorized operation.'
      );
    if (
      input.acceptance.projectId !== input.provenance.projectId ||
      input.acceptance.revisionId !== input.provenance.revisionId ||
      digest(input.acceptance.provenance.reviewEvidence) !== input.acceptance.evidenceDigest ||
      digest(input.acceptance.provenance) !== digest(portableProvenance(input.provenance))
    )
      throw new RuntimeFailure(
        'STALE_ARTIFACT',
        'Acceptance metadata does not match the immutable revision provenance.'
      );
    if (!path.isAbsolute(input.destination) || /[\\/]\.\.(?:[\\/]|$)/.test(input.destination))
      throw new RuntimeFailure(
        'MATERIALIZATION_FAILURE',
        'Export destination must be one unambiguous absolute path without traversal.'
      );
    const destination = path.resolve(input.destination);
    const allowedRoot = this.allowedRoots.find(
      (root) => contained(root, destination) && destination !== root
    );
    if (!allowedRoot)
      throw new RuntimeFailure(
        'UNAUTHORIZED_REQUEST',
        'Export destination is outside every configured or explicitly approved root.'
      );
    await mkdir(allowedRoot, { recursive: true });
    const rootReal = await realpath(allowedRoot);
    if (!contained(rootReal, destination))
      throw new RuntimeFailure('MATERIALIZATION_FAILURE', 'Export destination escaped its root.');
    await rejectSymlinkAncestors(rootReal, destination);
    let destinationExists = false;
    try {
      const destinationStat = await lstat(destination);
      if (destinationStat.isSymbolicLink() || !destinationStat.isDirectory())
        throw new RuntimeFailure(
          'MATERIALIZATION_FAILURE',
          'Existing export destination must be a real directory.'
        );
      destinationExists = true;
      if ((await readdir(destination)).length > 0)
        throw new RuntimeFailure(
          'MATERIALIZATION_FAILURE',
          'Existing non-empty export destinations are never overwritten.'
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const source = await verifySourceProvenance(input.provenance);
    const paths = await collectPortablePaths(source);
    const folded = paths.map((item) => item.toLocaleLowerCase('en-US'));
    if (new Set(folded).size !== folded.length)
      throw new RuntimeFailure(
        'MATERIALIZATION_FAILURE',
        'Accepted revision contains case-folding filename collisions.'
      );
    const parent = path.dirname(destination);
    await mkdir(parent, { recursive: true });
    const staging = path.join(parent, `.universal-export-${randomUUID()}`);
    const backup = path.join(parent, `.universal-empty-backup-${randomUUID()}`);
    let movedExisting = false;
    let committed = false;
    try {
      await cp(source, staging, {
        recursive: true,
        dereference: false,
        errorOnExist: true,
        force: false
      });
      const provenanceDocument = {
        version: EXPORT_WORKFLOW_VERSION,
        projectId: input.provenance.projectId,
        revisionId: input.provenance.revisionId,
        designPlanId: input.provenance.designPlanId,
        designPlanDigest: input.provenance.designPlanDigest,
        generatedProjectDigest: input.provenance.generatedProjectDigest,
        reviewEvidence: input.provenance.reviewEvidence,
        revisionCreatedAt: input.provenance.createdAt,
        acceptance: input.acceptance,
        exportedAt: this.now(),
        exportedBy: input.authorization.requestedBy.trim()
      };
      await mkdir(path.join(staging, '.universal'));
      await writeFile(
        path.join(staging, '.universal', 'provenance.json'),
        `${JSON.stringify(provenanceDocument, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' }
      );
      await this.beforeCommit?.(staging);
      if (destinationExists) {
        await rename(destination, backup);
        movedExisting = true;
      }
      await rename(staging, destination);
      committed = true;
      const record: ExportRecord = {
        version: EXPORT_WORKFLOW_VERSION,
        id: `export:${this.createId()}`,
        acceptanceId: input.acceptance.id,
        projectId: input.provenance.projectId,
        revisionId: input.provenance.revisionId,
        destination,
        exportedAt: provenanceDocument.exportedAt,
        manifestDigest: digest({ paths, provenanceDocument })
      };
      await mkdir(path.join(this.metadataRoot, 'exports'), { recursive: true });
      await writeFile(
        path.join(this.metadataRoot, 'exports', `${record.id.replaceAll(':', '_')}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' }
      );
      if (movedExisting) await rm(backup, { recursive: true, force: true });
      return record;
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if (committed) await rm(destination, { recursive: true, force: true });
      if (movedExisting) {
        try {
          await rename(backup, destination);
        } catch {
          throw new AggregateError(
            [error],
            'Export failed and the existing empty destination could not be restored.'
          );
        }
      }
      throw error;
    }
  }
}
