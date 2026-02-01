/**
 * Base LLM Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseLLMAdapter } from '../../../src/adapters/llm/base-adapter.js';
import { LLMError } from '../../../src/adapters/llm/llm-error.js';
import type {
  LLMAdapterConfig,
  LLMCompletionOptions,
  LLMResponse,
  LLMProvider,
} from '../../../src/types/llm.types.js';

/**
 * Mock implementation of BaseLLMAdapter for testing
 */
class MockAdapter extends BaseLLMAdapter {
  readonly provider: LLMProvider = 'openai';

  protected getDefaultModel(): string {
    return 'mock-model';
  }

  async *stream(
    prompt: string,
    options?: LLMCompletionOptions
  ): AsyncIterable<string> {
    this.validatePrompt(prompt);
    yield 'test chunk';
  }

  async complete(
    prompt: string,
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    this.validatePrompt(prompt);
    return {
      content: 'test response',
      provider: this.provider,
      model: this.model,
    };
  }

  async validateKey(): Promise<boolean> {
    return true;
  }

  // Expose protected methods for testing
  public testMergeOptions(options?: LLMCompletionOptions) {
    return this.mergeOptions(options);
  }

  public testValidatePrompt(prompt: string) {
    return this.validatePrompt(prompt);
  }

  public async testWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return this.withTimeout(operation, timeoutMs);
  }

  // Expose model for testing
  public getModel(): string {
    return this.model;
  }
}

describe('BaseLLMAdapter', () => {
  describe('constructor', () => {
    it('should throw if API key is missing', () => {
      expect(() => new MockAdapter({ apiKey: '' })).toThrow(LLMError);
    });

    it('should accept valid API key', () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should use default model if not provided', () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });
      expect(adapter.getModel()).toBe('mock-model');
    });

    it('should use custom model if provided', () => {
      const adapter = new MockAdapter({ apiKey: 'test-key', model: 'custom-model' });
      expect(adapter.getModel()).toBe('custom-model');
    });
  });

  describe('mergeOptions', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter({ apiKey: 'test-key' });
    });

    it('should return defaults when no options provided', () => {
      const result = adapter.testMergeOptions();

      expect(result.timeout).toBe(30000);
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(4096);
      expect(result.systemPrompt).toBe('');
    });

    it('should override defaults with provided options', () => {
      const result = adapter.testMergeOptions({
        timeout: 60000,
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.timeout).toBe(60000);
      expect(result.temperature).toBe(0.5);
      expect(result.maxTokens).toBe(2048);
      expect(result.systemPrompt).toBe('You are a helpful assistant');
    });

    it('should partially override defaults', () => {
      const result = adapter.testMergeOptions({
        timeout: 60000,
      });

      expect(result.timeout).toBe(60000);
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(4096);
    });
  });

  describe('validatePrompt', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter({ apiKey: 'test-key' });
    });

    it('should throw for empty prompt', () => {
      expect(() => adapter.testValidatePrompt('')).toThrow(LLMError);
    });

    it('should throw for whitespace-only prompt', () => {
      expect(() => adapter.testValidatePrompt('   ')).toThrow(LLMError);
    });

    it('should not throw for valid prompt', () => {
      expect(() => adapter.testValidatePrompt('Hello, world!')).not.toThrow();
    });
  });

  describe('withTimeout', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter({ apiKey: 'test-key' });
    });

    it('should return result for fast operations', async () => {
      const result = await adapter.testWithTimeout(
        async () => 'success',
        1000
      );

      expect(result).toBe('success');
    });

    it('should throw timeout error for slow operations', async () => {
      const slowOperation = async (signal: AbortSignal) => {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 2000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Aborted'));
          });
        });
        return 'never';
      };

      await expect(adapter.testWithTimeout(slowOperation, 100)).rejects.toThrow(
        LLMError
      );
    });

    it('should convert generic errors to LLMError', async () => {
      const failingOperation = async () => {
        throw new Error('Generic error');
      };

      await expect(adapter.testWithTimeout(failingOperation, 1000)).rejects.toThrow(
        LLMError
      );
    });
  });

  describe('stream', () => {
    it('should yield chunks for valid prompt', async () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });
      const chunks: string[] = [];

      for await (const chunk of adapter.stream('test prompt')) {
        chunks.push(chunk);
      }

      expect(chunks).toContain('test chunk');
    });

    it('should throw for empty prompt', async () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });

      await expect(async () => {
        for await (const _ of adapter.stream('')) {
          // Should not reach here
        }
      }).rejects.toThrow(LLMError);
    });
  });

  describe('complete', () => {
    it('should return response for valid prompt', async () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });
      const result = await adapter.complete('test prompt');

      expect(result.content).toBe('test response');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('mock-model');
    });

    it('should throw for empty prompt', async () => {
      const adapter = new MockAdapter({ apiKey: 'test-key' });

      await expect(adapter.complete('')).rejects.toThrow(LLMError);
    });
  });
});
