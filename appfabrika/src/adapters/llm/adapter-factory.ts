/**
 * LLM Adapter Factory
 * Creates appropriate adapter instances based on provider type
 */

import type { LLMAdapter, LLMAdapterConfig, LLMProvider } from '../../types/llm.types.js';
import { OpenAIAdapter } from './openai.adapter.js';
import { AnthropicAdapter } from './anthropic.adapter.js';

/**
 * Creates an LLM adapter for the specified provider
 *
 * @param provider - The LLM provider to use ('openai' or 'anthropic')
 * @param config - Configuration including API key and optional settings
 * @returns An LLMAdapter instance for the specified provider
 * @throws Error if provider is not supported
 *
 * @example
 * ```typescript
 * const adapter = createLLMAdapter('openai', { apiKey: 'sk-...' });
 * const response = await adapter.complete('Hello, world!');
 * ```
 */
export function createLLMAdapter(
  provider: LLMProvider,
  config: LLMAdapterConfig
): LLMAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(config);

    case 'anthropic':
      return new AnthropicAdapter(config);

    default:
      // This should never happen with TypeScript, but handle it anyway
      throw new Error(`Unknown LLM provider: ${provider as string}`);
  }
}

/**
 * Returns the list of supported LLM providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'anthropic'];
}

/**
 * Checks if a provider is supported
 */
export function isProviderSupported(provider: string): provider is LLMProvider {
  return getSupportedProviders().includes(provider as LLMProvider);
}
