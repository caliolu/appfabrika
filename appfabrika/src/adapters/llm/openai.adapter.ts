/**
 * OpenAI Adapter
 * Implements LLMAdapter interface for OpenAI GPT models
 */

import OpenAI from 'openai';
import { BaseLLMAdapter } from './base-adapter.js';
import { LLMError } from './llm-error.js';
import type {
  LLMAdapterConfig,
  LLMCompletionOptions,
  LLMResponse,
  LLMProvider,
} from '../../types/llm.types.js';

/**
 * OpenAI adapter for GPT models
 * Supports streaming and completion APIs
 */
export class OpenAIAdapter extends BaseLLMAdapter {
  readonly provider: LLMProvider = 'openai';
  private client: OpenAI;

  constructor(config: LLMAdapterConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  protected getDefaultModel(): string {
    return 'gpt-4';
  }

  /**
   * Stream response chunks from OpenAI
   */
  async *stream(
    prompt: string,
    options?: LLMCompletionOptions
  ): AsyncIterable<string> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (merged.systemPrompt) {
      messages.push({ role: 'system', content: merged.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true,
        temperature: merged.temperature,
        max_tokens: merged.maxTokens,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw LLMError.fromError(error);
    }
  }

  /**
   * Get complete response from OpenAI
   */
  async complete(
    prompt: string,
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (merged.systemPrompt) {
      messages.push({ role: 'system', content: merged.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.withTimeout(
      async (signal) => {
        return this.client.chat.completions.create(
          {
            model: this.model,
            messages,
            temperature: merged.temperature,
            max_tokens: merged.maxTokens,
          },
          { signal }
        );
      },
      merged.timeout
    );

    return {
      content: response.choices[0]?.message?.content ?? '',
      provider: this.provider,
      model: this.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Validate that the API key is working
   */
  async validateKey(): Promise<boolean> {
    try {
      // Make a simple API call to verify the key works
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
