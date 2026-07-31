import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import prettier from 'prettier';

const checkOnly = process.argv.includes('--check');
const repoRoot = process.cwd();
const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
  encoding: 'buffer'
})
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const filesToFormat = [];

for (const file of trackedFiles) {
  const fileInfo = await prettier.getFileInfo(file, {
    ignorePath: '.prettierignore'
  });

  if (!fileInfo.ignored && fileInfo.inferredParser) {
    filesToFormat.push(file);
  }
}

let hasUnformattedFiles = false;

for (const file of filesToFormat) {
  const absolutePath = path.join(repoRoot, file);
  const source = await readFile(absolutePath, 'utf8');
  const config = await prettier.resolveConfig(absolutePath);
  const options = { ...config, filepath: absolutePath };

  if (checkOnly) {
    if (!(await prettier.check(source, options))) {
      hasUnformattedFiles = true;
      process.stderr.write(`[warn] ${file}\n`);
    }
    continue;
  }

  const formatted = await prettier.format(source, options);
  if (formatted !== source) {
    await writeFile(absolutePath, formatted);
    process.stdout.write(`${file}\n`);
  }
}

if (checkOnly && hasUnformattedFiles) {
  process.stderr.write(
    'Code style issues found in the files above. Run `pnpm format` to fix them.\n'
  );
  process.exitCode = 1;
}
