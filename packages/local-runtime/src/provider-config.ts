import {
  DeterministicReactProvider,
  ReactGenerator,
  type ReactGenerationProvider
} from '@universal/generation';
import { RuntimeFailure } from './errors.ts';
export interface LiveProviderConfiguration {
  providerId: string;
  model: string;
  apiKey: string;
}
export interface LiveProviderFactory {
  create(config: LiveProviderConfiguration): ReactGenerationProvider;
}
export interface ConfiguredGenerator {
  generator: ReactGenerator;
  providerId: string;
  live: boolean;
}
export function createConfiguredGenerator(
  environment: Readonly<Record<string, string | undefined>>,
  factory?: LiveProviderFactory
): ConfiguredGenerator {
  const providerId = environment.UNIVERSAL_GENERATION_PROVIDER?.trim() || 'deterministic';
  if (providerId === 'deterministic')
    return {
      generator: new ReactGenerator(new DeterministicReactProvider()),
      providerId: 'universal.deterministic-react',
      live: false
    };
  if (!factory)
    throw new RuntimeFailure('INVALID_REQUEST', `Live provider ${providerId} is not installed.`);
  const apiKey = environment.UNIVERSAL_PROVIDER_API_KEY,
    model = environment.UNIVERSAL_PROVIDER_MODEL;
  if (!apiKey || !model)
    throw new RuntimeFailure(
      'INVALID_REQUEST',
      'Live provider configuration requires runtime-only API key and model values.'
    );
  const provider = factory.create({ providerId, model, apiKey });
  return {
    generator: new ReactGenerator(provider, [apiKey]),
    providerId: provider.capabilities.providerId,
    live: true
  };
}
