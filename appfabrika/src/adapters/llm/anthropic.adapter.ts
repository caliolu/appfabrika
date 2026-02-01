/**
 * Anthropic Adapter
 * Implements LLMAdapter interface for Claude models
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMAdapter } from './base-adapter.js';
import { LLMError } from './llm-error.js';
import type {
  LLMAdapterConfig,
  LLMCompletionOptions,
  LLMResponse,
  LLMProvider,
} from '../../types/llm.types.js';

/**
 * Anthropic adapter for Claude models
 * Supports streaming and completion APIs
 */
export class AnthropicAdapter extends BaseLLMAdapter {
  readonly provider: LLMProvider = 'anthropic';
  private client: Anthropic;

  constructor(config: LLMAdapterConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  protected getDefaultModel(): string {
    return 'claude-3-5-sonnet-latest';
  }

  /**
   * Stream response chunks from Anthropic
   */
  async *stream(
    prompt: string,
    options?: LLMCompletionOptions
  ): AsyncIterable<string> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: merged.maxTokens,
        system: merged.systemPrompt || undefined,
        messages: [{ role: 'user', content: prompt }],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      throw LLMError.fromError(error);
    }
  }

  /**
   * Get complete response from Anthropic
   */
  async complete(
    prompt: string,
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const response = await this.withTimeout(
      async (signal) => {
        return this.client.messages.create(
          {
            model: this.model,
            max_tokens: merged.maxTokens,
            system: merged.systemPrompt || undefined,
            messages: [{ role: 'user', content: prompt }],
          },
          { signal }
        );
      },
      merged.timeout
    );

    const textContent = response.content.find((c) => c.type === 'text');
    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      provider: this.provider,
      model: this.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens:
              response.usage.input_tokens + response.usage.output_tokens,
          }
        : undefined,
    };
  }

  /**
   * Validate that the API key is working
   */
  async validateKey(): Promise<boolean> {
    try {
      // Simple validation by making a minimal request
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
