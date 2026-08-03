import {
  DeterministicReactProvider,
  ReactGenerator,
  type ReactGenerationProvider
} from '@universal/generation';
import { RuntimeFailure } from './errors.ts';
export interface LiveProviderConfiguration {
  providerId: string;
  /** Optional: a subscription-backed CLI provider selects its own default model. */
  model?: string | undefined;
  /**
   * Optional, and absent for every provider shipped today. The CLI providers
   * authenticate through their own subscription login, so no secret reaches the
   * runtime. It remains here for a future provider that does need one.
   */
  apiKey?: string | undefined;
}
export interface LiveProviderFactory {
  create(config: LiveProviderConfiguration): ReactGenerationProvider;
}
export interface ConfiguredGenerator {
  generator: ReactGenerator;
  providerId: string;
  live: boolean;
}
/**
 * Providers that run on an operator's existing Claude or Codex subscription. They
 * require no API key -- demanding one would have made the whole point of the
 * subscription path impossible.
 */
const SUBSCRIPTION_PROVIDERS: ReadonlySet<string> = new Set(['claude-code', 'codex']);
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
    model = environment.UNIVERSAL_PROVIDER_MODEL,
    subscription = SUBSCRIPTION_PROVIDERS.has(providerId);
  if (!subscription && (!apiKey || !model))
    throw new RuntimeFailure(
      'INVALID_REQUEST',
      'Live provider configuration requires runtime-only API key and model values.'
    );
  const provider = factory.create({
    providerId,
    ...(model ? { model } : {}),
    ...(subscription ? {} : { apiKey })
  });
  return {
    generator: new ReactGenerator(provider, apiKey && !subscription ? [apiKey] : []),
    providerId: provider.capabilities.providerId,
    live: true
  };
}
