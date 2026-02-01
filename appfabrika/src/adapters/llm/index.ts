/**
 * LLM Adapter - Barrel Export
 * Re-exports all LLM adapter components
 */

export { LLMError } from './llm-error.js';
export { BaseLLMAdapter } from './base-adapter.js';
export { OpenAIAdapter } from './openai.adapter.js';
export { AnthropicAdapter } from './anthropic.adapter.js';
export {
  createLLMAdapter,
  getSupportedProviders,
  isProviderSupported,
} from './adapter-factory.js';
export {
  ResponseTransformer,
  getResponseTransformer,
  resetResponseTransformer,
} from './response-transformer.js';

// Re-export types for convenience
export type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMCompletionOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
} from '../../types/llm.types.js';
export { LLMErrorCode, DEFAULT_LLM_OPTIONS } from '../../types/llm.types.js';
