/**
 * Base LLM Adapter
 * Abstract base class providing common functionality for LLM adapters
 */

import type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMCompletionOptions,
  LLMResponse,
  LLMProvider,
} from '../../types/llm.types.js';
import { DEFAULT_LLM_OPTIONS } from '../../types/llm.types.js';
import { LLMError } from './llm-error.js';

/**
 * Abstract base class for LLM adapters
 * Provides common validation and utility methods
 */
export abstract class BaseLLMAdapter implements LLMAdapter {
  /** Provider name */
  abstract readonly provider: LLMProvider;

  /** API key for authentication */
  protected readonly apiKey: string;

  /** Model to use */
  protected readonly model: string;

  /** Base URL for API calls */
  protected readonly baseUrl?: string;

  constructor(config: LLMAdapterConfig) {
    if (!config.apiKey) {
      throw LLMError.authFailed('API key is required');
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? this.getDefaultModel();
    this.baseUrl = config.baseUrl;
  }

  /**
   * Returns the default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Stream response chunks from the LLM
   */
  abstract stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string>;

  /**
   * Get complete response from the LLM
   */
  abstract complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse>;

  /**
   * Validate that the API key is working
   */
  abstract validateKey(): Promise<boolean>;

  /**
   * Merges provided options with defaults
   */
  protected mergeOptions(options?: LLMCompletionOptions): Required<LLMCompletionOptions> {
    return {
      timeout: options?.timeout ?? DEFAULT_LLM_OPTIONS.timeout,
      temperature: options?.temperature ?? DEFAULT_LLM_OPTIONS.temperature,
      maxTokens: options?.maxTokens ?? DEFAULT_LLM_OPTIONS.maxTokens,
      systemPrompt: options?.systemPrompt ?? DEFAULT_LLM_OPTIONS.systemPrompt,
    };
  }

  /**
   * Creates an AbortController with timeout
   */
  protected createTimeoutController(timeoutMs: number): {
    controller: AbortController;
    timeoutId: ReturnType<typeof setTimeout>;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    return { controller, timeoutId };
  }

  /**
   * Clears a timeout and handles cleanup
   */
  protected clearTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    clearTimeout(timeoutId);
  }

  /**
   * Wraps an async operation with timeout handling
   */
  protected async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const { controller, timeoutId } = this.createTimeoutController(timeoutMs);

    try {
      const result = await operation(controller.signal);
      return result;
    } catch (error) {
      if (controller.signal.aborted) {
        throw LLMError.timeout(`Request timed out after ${timeoutMs}ms`);
      }
      throw LLMError.fromError(error);
    } finally {
      this.clearTimeout(timeoutId);
    }
  }

  /**
   * Validates that a prompt is not empty
   */
  protected validatePrompt(prompt: string): void {
    if (!prompt || !prompt.trim()) {
      throw LLMError.invalidResponse('Prompt cannot be empty');
    }
  }
}
