/**
 * OpenAI Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { LLMError } from '../../../src/adapters/llm/llm-error.js';

// Create mock functions
const mockCreate = vi.fn();
const mockModelsList = vi.fn();

// Mock the OpenAI module before any imports
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      models = {
        list: mockModelsList,
      };
    },
  };
});

// Import after mock is set up
import { OpenAIAdapter } from '../../../src/adapters/llm/openai.adapter.js';

describe('OpenAIAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with valid API key', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe('openai');
    });

    it('should throw for missing API key', () => {
      expect(() => new OpenAIAdapter({ apiKey: '' })).toThrow(LLMError);
    });

    it('should use gpt-4 as default model', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      expect(adapter.provider).toBe('openai');
    });

    it('should allow custom model', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key', model: 'gpt-3.5-turbo' });
      expect(adapter).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should return LLMResponse for valid prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello, world!' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const response = await adapter.complete('Say hello');

      expect(response.content).toBe('Hello, world!');
      expect(response.provider).toBe('openai');
      expect(response.model).toBe('gpt-4');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should throw for empty prompt', async () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await expect(adapter.complete('')).rejects.toThrow(LLMError);
    });

    it('should include system prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await adapter.complete('Hello', { systemPrompt: 'You are helpful' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
          ],
        }),
        expect.any(Object)
      );
    });

    it('should not include system prompt when empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await adapter.complete('Hello');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        expect.any(Object)
      );
    });

    it('should handle empty response content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const response = await adapter.complete('Hello');

      expect(response.content).toBe('');
    });

    it('should handle missing usage stats', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello' } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const response = await adapter.complete('Hello');

      expect(response.usage).toBeUndefined();
    });

    it('should convert API errors to LLMError', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await expect(adapter.complete('Hello')).rejects.toThrow(LLMError);
    });
  });

  describe('stream', () => {
    it('should yield chunks from stream', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' ' } }] };
          yield { choices: [{ delta: { content: 'world!' } }] };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const chunks: string[] = [];
      for await (const chunk of adapter.stream('Say hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' ', 'world!']);
    });

    it('should skip empty chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: null } }] };
          yield { choices: [{ delta: { content: '' } }] };
          yield { choices: [{ delta: {} }] };
          yield { choices: [{ delta: { content: 'world!' } }] };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const chunks: string[] = [];
      for await (const chunk of adapter.stream('Say hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', 'world!']);
    });

    it('should throw for empty prompt', async () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });

      await expect(async () => {
        for await (const _ of adapter.stream('')) {
          // Should not reach here
        }
      }).rejects.toThrow(LLMError);
    });

    it('should convert API errors to LLMError', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });

      await expect(async () => {
        for await (const _ of adapter.stream('Hello')) {
          // Should not reach here
        }
      }).rejects.toThrow(LLMError);
    });
  });

  describe('validateKey', () => {
    it('should return true for valid key', async () => {
      mockModelsList.mockResolvedValue({ data: [] });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(true);
      expect(mockModelsList).toHaveBeenCalled();
    });

    it('should return false for invalid key', async () => {
      mockModelsList.mockRejectedValue(new Error('Unauthorized'));

      const adapter = new OpenAIAdapter({ apiKey: 'invalid-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockModelsList.mockRejectedValue(new Error('ECONNREFUSED'));

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(false);
    });
  });

  describe('options handling', () => {
    it('should use default options', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello' } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await adapter.complete('Hello');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 4096,
        }),
        expect.any(Object)
      );
    });

    it('should override defaults with provided options', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello' } }],
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test-key' });
      await adapter.complete('Hello', {
        temperature: 0.5,
        maxTokens: 2048,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 2048,
        }),
        expect.any(Object)
      );
    });
  });
});
