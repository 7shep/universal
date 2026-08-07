import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SkillTargetName = 'agents' | 'claude';

export type InstallSkillsTarget = SkillTargetName | 'both';

export interface InstallSkillsOptions {
  cwd?: string;
  force?: boolean;
  /**
   * Which agent director(ies) to write skills into. Defaults to autodetection: targets whose
   * top-level directory (`.agents` or `.claude`) already exists in the project, falling back to
   * `.agents` alone when neither is present.
   */
  target?: InstallSkillsTarget;
  /** Compute and report what would happen without writing anything, including the manifest. */
  dryRun?: boolean;
}

/**
 * Every bundled skill lands in exactly one bucket per agent target:
 *
 * - `installed` — the skill was not present and was written for the first time.
 * - `updated` — the local copy matched what a previous run wrote (or was incomplete), and the
 *   bundled version has since changed, so it was replaced.
 * - `unchanged` — the local copy already matches the bundled version; nothing was written.
 * - `preserved` — the local copy differs from both the bundled version and anything this installer
 *   wrote, so it is treated as user-authored and left alone.
 */
export interface TargetResult {
  name: SkillTargetName;
  root: string;
  installed: string[];
  updated: string[];
  unchanged: string[];
  preserved: string[];
}

export interface InstallSkillsResult {
  dryRun: boolean;
  targets: TargetResult[];
}

interface SkillManifest {
  version: number;
  package?: string | undefined;
  skills: Record<string, { digest: string }>;
}

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledSkills = resolve(moduleDirectory, 'skills');

/** Tracks what this installer wrote, so a later run can tell our own output from a user's edits. */
const manifestName = '.universal-skills.json';
const manifestVersion = 1;

const targetDirectories: Record<SkillTargetName, string> = {
  agents: '.agents',
  claude: '.claude'
};

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  );
}

async function packageVersion(): Promise<string | undefined> {
  return readFile(resolve(moduleDirectory, '../package.json'), 'utf8').then(
    (raw) => JSON.parse(raw).version as string,
    () => undefined
  );
}

/**
 * Content digest of a skill directory: every file's path and bytes, order-independent. Two
 * directories share a digest only when they hold identical files with identical contents.
 */
async function digestDirectory(root: string): Promise<string> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);

  const hash = createHash('sha256');
  for (const path of files.sort()) {
    // Normalize separators so a digest taken on Windows matches one taken on POSIX.
    hash.update(relative(root, path).split(sep).join('/'));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function readManifest(targetRoot: string): Promise<SkillManifest> {
  return readFile(resolve(targetRoot, manifestName), 'utf8').then(
    (raw) => {
      const parsed = JSON.parse(raw) as SkillManifest;
      if (parsed?.version !== manifestVersion || typeof parsed.skills !== 'object') {
        return { version: manifestVersion, skills: {} };
      }
      return { version: manifestVersion, package: parsed.package, skills: parsed.skills ?? {} };
    },
    () => ({ version: manifestVersion, skills: {} })
  );
}

/**
 * Resolves which agent target(s) to install into.
 *
 * An explicit `target` option always wins. Otherwise this autodetects: a target is selected when
 * its top-level directory (`.agents` or `.claude`) already exists in the project, since that is
 * the signal that the corresponding agent is in use there. When neither exists (a fresh project),
 * it falls back to `.agents` alone rather than writing two directories nobody asked for yet.
 */
async function resolveTargetNames(
  projectRoot: string,
  target: InstallSkillsTarget | undefined
): Promise<SkillTargetName[]> {
  if (target === 'both') return ['agents', 'claude'];
  if (target === 'agents' || target === 'claude') return [target];

  const detected: SkillTargetName[] = [];
  for (const name of Object.keys(targetDirectories) as SkillTargetName[]) {
    if (await exists(resolve(projectRoot, targetDirectories[name]))) {
      detected.push(name);
    }
  }
  return detected.length > 0 ? detected : ['agents'];
}

export async function installSkills(
  options: InstallSkillsOptions = {}
): Promise<InstallSkillsResult> {
  const projectRoot = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun ?? false;
  const targetNames = await resolveTargetNames(projectRoot, options.target);

  const skillNames = (await readdir(bundledSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillNames.length === 0) {
    throw new Error('No bundled skills found at ' + bundledSkills + '.');
  }

  const bundledDigests = new Map<string, string>();
  for (const skillName of skillNames) {
    bundledDigests.set(skillName, await digestDirectory(resolve(bundledSkills, skillName)));
  }

  const version = await packageVersion();
  const result: InstallSkillsResult = { dryRun, targets: [] };

  for (const name of targetNames) {
    const targetRoot = resolve(projectRoot, targetDirectories[name], 'skills');
    const targetResult: TargetResult = {
      name,
      root: targetRoot,
      installed: [],
      updated: [],
      unchanged: [],
      preserved: []
    };

    if (!dryRun) {
      await mkdir(targetRoot, { recursive: true });
    }
    const manifest = (await exists(targetRoot))
      ? await readManifest(targetRoot)
      : { version: manifestVersion, skills: {} };
    const next: SkillManifest = { version: manifestVersion, package: version, skills: {} };

    for (const skillName of skillNames) {
      const source = resolve(bundledSkills, skillName);
      const destination = resolve(targetRoot, skillName);
      const bundledDigest = bundledDigests.get(skillName) as string;

      const write = async (bucket: 'installed' | 'updated'): Promise<void> => {
        if (!dryRun) {
          await rm(destination, { recursive: true, force: true });
          await cp(source, destination, { recursive: true, force: true });
        }
        next.skills[skillName] = { digest: bundledDigest };
        targetResult[bucket].push(destination);
      };

      if (!(await exists(destination))) {
        await write('installed');
        continue;
      }

      if (options.force) {
        await write('updated');
        continue;
      }

      const currentDigest = await digestDirectory(destination);
      if (currentDigest === bundledDigest) {
        // Already current. Record the digest so a copy installed before manifests existed is
        // recognized as ours and stays eligible for future updates.
        next.skills[skillName] = { digest: bundledDigest };
        targetResult.unchanged.push(destination);
        continue;
      }

      const recorded = manifest.skills[skillName]?.digest;
      if (recorded === currentDigest) {
        // Untouched since we last wrote it, and the bundle has moved on. Safe to update.
        await write('updated');
        continue;
      }

      if (!(await exists(resolve(destination, 'SKILL.md')))) {
        // No SKILL.md means the directory is not a usable skill — an interrupted copy, most
        // likely. Repairing beats leaving the user with a permanently broken skill.
        await write('updated');
        continue;
      }

      // Locally modified. Keep the user's work and carry their provenance entry forward.
      if (recorded) next.skills[skillName] = { digest: recorded };
      targetResult.preserved.push(destination);
    }

    if (!dryRun) {
      await writeFile(
        resolve(targetRoot, manifestName),
        JSON.stringify(next, null, 2) + '\n',
        'utf8'
      );
    }

    result.targets.push(targetResult);
  }

  return result;
}
