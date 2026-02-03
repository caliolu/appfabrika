/**
 * Anthropic Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMError } from '../../../src/adapters/llm/llm-error.js';

// Create mock functions
const mockCreate = vi.fn();
const mockStream = vi.fn();

// Mock the Anthropic module before any imports
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
    },
  };
});

// Import after mock is set up
import { AnthropicAdapter } from '../../../src/adapters/llm/anthropic.adapter.js';

describe('AnthropicAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with valid API key', () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe('anthropic');
    });

    it('should throw for missing API key', () => {
      expect(() => new AnthropicAdapter({ apiKey: '' })).toThrow(LLMError);
    });

    it('should use claude-sonnet-4-20250514 as default model', () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      expect(adapter.provider).toBe('anthropic');
    });

    it('should allow custom model', () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key', model: 'claude-3-opus-20240229' });
      expect(adapter).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should return LLMResponse for valid prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello, world!' }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const response = await adapter.complete('Say hello');

      expect(response.content).toBe('Hello, world!');
      expect(response.provider).toBe('anthropic');
      expect(response.model).toBe('claude-sonnet-4-20250514');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should throw for empty prompt', async () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await expect(adapter.complete('')).rejects.toThrow(LLMError);
    });

    it('should include system prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await adapter.complete('Hello', { systemPrompt: 'You are helpful' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        expect.any(Object)
      );
    });

    it('should not include system prompt when empty', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await adapter.complete('Hello');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: undefined,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        expect.any(Object)
      );
    });

    it('should handle empty content array', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const response = await adapter.complete('Hello');

      expect(response.content).toBe('');
    });

    it('should handle missing usage stats', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const response = await adapter.complete('Hello');

      expect(response.usage).toBeUndefined();
    });

    it('should convert API errors to LLMError', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await expect(adapter.complete('Hello')).rejects.toThrow(LLMError);
    });
  });

  describe('stream', () => {
    it('should yield chunks from stream', async () => {
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' ' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } };
        },
      };

      mockStream.mockReturnValue(mockStreamIterator);

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const chunks: string[] = [];
      for await (const chunk of adapter.stream('Say hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' ', 'world!']);
    });

    it('should skip non-text delta events', async () => {
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: {} };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_start', content_block: {} };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } };
          yield { type: 'message_stop' };
        },
      };

      mockStream.mockReturnValue(mockStreamIterator);

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const chunks: string[] = [];
      for await (const chunk of adapter.stream('Say hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', 'world!']);
    });

    it('should throw for empty prompt', async () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });

      await expect(async () => {
        for await (const _ of adapter.stream('')) {
          // Should not reach here
        }
      }).rejects.toThrow(LLMError);
    });

    it('should convert API errors to LLMError', async () => {
      mockStream.mockImplementation(() => {
        throw new Error('Network error');
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });

      await expect(async () => {
        for await (const _ of adapter.stream('Hello')) {
          // Should not reach here
        }
      }).rejects.toThrow(LLMError);
    });
  });

  describe('validateKey', () => {
    it('should return true for valid key', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'hi' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        })
      );
    });

    it('should return false for invalid key', async () => {
      mockCreate.mockRejectedValue(new Error('Unauthorized'));

      const adapter = new AnthropicAdapter({ apiKey: 'invalid-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockCreate.mockRejectedValue(new Error('ECONNREFUSED'));

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      const result = await adapter.validateKey();

      expect(result).toBe(false);
    });
  });

  describe('options handling', () => {
    it('should use default options', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await adapter.complete('Hello');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
        }),
        expect.any(Object)
      );
    });

    it('should override defaults with provided options', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello' }],
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test-key' });
      await adapter.complete('Hello', {
        maxTokens: 2048,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        }),
        expect.any(Object)
      );
    });
  });
});
