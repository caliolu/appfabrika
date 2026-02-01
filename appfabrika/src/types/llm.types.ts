/**
 * LLM Types
 * Defines interfaces and types for LLM adapter abstraction
 */

import type { LLMProvider } from './config.types.js';

/**
 * Error codes for LLM operations
 * Based on Architecture ADR error handling standards
 */
export enum LLMErrorCode {
  /** API request timed out (default 30s) */
  TIMEOUT = 'E001',
  /** Rate limit exceeded */
  RATE_LIMIT = 'E002',
  /** API key authentication failed */
  AUTH_FAILED = 'E003',
  /** Network connection error */
  NETWORK = 'E004',
  /** Invalid or unexpected response from LLM */
  INVALID_RESPONSE = 'E005',
}

/**
 * Options for LLM completion requests
 */
export interface LLMCompletionOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** System prompt/context */
  systemPrompt?: string;
}

/**
 * Default completion options
 */
export const DEFAULT_LLM_OPTIONS: Required<LLMCompletionOptions> = {
  timeout: 30000,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '',
};

/**
 * Chunk of streamed response
 */
export interface LLMStreamChunk {
  /** Text content of this chunk */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Response from an LLM completion
 */
export interface LLMResponse {
  /** Full content of the response */
  content: string;
  /** Provider that generated the response */
  provider: LLMProvider;
  /** Model used for generation */
  model: string;
  /** Token usage statistics (if available) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Common interface for LLM adapters
 * Allows different LLM providers to be used interchangeably
 * Based on Architecture ADR-001 (Streaming Response)
 */
export interface LLMAdapter {
  /** Get the provider name */
  readonly provider: LLMProvider;

  /**
   * Stream response chunks as they arrive
   * @param prompt - The prompt to send to the LLM
   * @param options - Optional completion options
   * @returns AsyncIterable that yields response chunks
   */
  stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string>;

  /**
   * Get complete response as single string
   * @param prompt - The prompt to send to the LLM
   * @param options - Optional completion options
   * @returns Promise resolving to the full response
   */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse>;

  /**
   * Validate that the API key is working
   * @returns Promise resolving to true if valid, false otherwise
   */
  validateKey(): Promise<boolean>;
}

/**
 * Configuration for creating an LLM adapter
 */
export interface LLMAdapterConfig {
  /** API key for the provider */
  apiKey: string;
  /** Model to use (provider-specific) */
  model?: string;
  /** Base URL override (for testing/proxies) */
  baseUrl?: string;
}

// Re-export LLMProvider for convenience
export { LLMProvider } from './config.types.js';
