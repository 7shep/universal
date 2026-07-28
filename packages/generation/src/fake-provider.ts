import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type {
  ProjectGenerationRequest,
  RawGeneratedProject,
  ReactGenerationProvider
} from './contracts.ts';

const readFixture = (name: string) =>
  readFile(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
export class DeterministicReactProvider implements ReactGenerationProvider {
  readonly capabilities = {
    providerId: 'universal.deterministic-react',
    contractVersions: ['1.0.0'] as const,
    structuredOutput: true as const,
    deterministic: true,
    requiresCredentials: false
  };
  async generate(
    request: ProjectGenerationRequest,
    signal?: AbortSignal
  ): Promise<RawGeneratedProject> {
    if (signal?.aborted) throw signal.reason ?? new Error('Generation cancelled.');
    if (request.context.pageMap.pages.length === 0)
      throw new Error('A generated site needs at least one page.');
    const [app, styles] = await Promise.all([
      readFixture('fake-app.tsx.txt'),
      readFixture('fake-styles.css.txt')
    ]);
    return {
      files: [
        { path: 'src/App.tsx', content: app, kind: 'react' },
        { path: 'src/styles.css', content: styles, kind: 'stylesheet' }
      ]
    };
  }
}
