import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InstallSkillsOptions {
  cwd?: string;
  force?: boolean;
}

export interface InstallSkillsResult {
  installed: string[];
  skipped: string[];
  targets: string[];
}

const bundledSkills = resolve(dirname(fileURLToPath(import.meta.url)), 'skills');

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  );
}

export async function installSkills(
  options: InstallSkillsOptions = {}
): Promise<InstallSkillsResult> {
  const projectRoot = resolve(options.cwd ?? process.cwd());
  const targets = [resolve(projectRoot, '.agents/skills'), resolve(projectRoot, '.claude/skills')];
  const skillNames = (await readdir(bundledSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillNames.length === 0) {
    throw new Error('No bundled skills found at ' + bundledSkills + '.');
  }

  const installed: string[] = [];
  const skipped: string[] = [];
  for (const targetRoot of targets) {
    await mkdir(targetRoot, { recursive: true });
    for (const skillName of skillNames) {
      const destination = resolve(targetRoot, skillName);
      const destinationExists = await exists(destination);
      if (!options.force && destinationExists) {
        skipped.push(destination);
        continue;
      }
      if (destinationExists) {
        await rm(destination, { recursive: true, force: true });
      }
      await cp(resolve(bundledSkills, skillName), destination, {
        recursive: true,
        force: true
      });
      installed.push(destination);
    }
  }

  return { installed, skipped, targets };
}
