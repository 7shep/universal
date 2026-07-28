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
    const fixtureFiles = [
      ['src/App.tsx', 'fake-app.tsx.txt', 'react'],
      ['src/components/SiteHeader.tsx', 'fake-site-header.tsx.txt', 'react'],
      ['src/components/SiteFooter.tsx', 'fake-site-footer.tsx.txt', 'react'],
      ['src/pages/HomePage.tsx', 'fake-home-page.tsx.txt', 'react'],
      ['src/pages/ProductPage.tsx', 'fake-product-page.tsx.txt', 'react'],
      ['src/pages/CraftPage.tsx', 'fake-craft-page.tsx.txt', 'react'],
      ['src/data/content.ts', 'fake-content.ts.txt', 'typescript'],
      ['src/styles.css', 'fake-styles.css.txt', 'stylesheet'],
      ['src/styles/tokens.css', 'fake-tokens.css.txt', 'stylesheet'],
      ['src/styles/components.css', 'fake-components.css.txt', 'stylesheet'],
      ['src/styles/pages.css', 'fake-pages.css.txt', 'stylesheet']
    ] as const;
    return {
      files: await Promise.all(
        fixtureFiles.map(async ([path, fixture, kind]) => ({
          path,
          content: await readFixture(fixture),
          kind
        }))
      )
    };
  }
}
