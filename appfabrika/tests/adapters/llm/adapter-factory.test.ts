/**
 * LLM Adapter Factory Tests
 */

import { describe, it, expect, vi } from 'vitest';
import type { LLMProvider } from '../../../src/types/llm.types.js';

// Mock OpenAI SDK before imports
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: vi.fn() } };
      models = { list: vi.fn() };
    },
  };
});

// Mock Anthropic SDK before imports
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: vi.fn(), stream: vi.fn() };
    },
  };
});

import {
  createLLMAdapter,
  getSupportedProviders,
  isProviderSupported,
} from '../../../src/adapters/llm/adapter-factory.js';
import { OpenAIAdapter } from '../../../src/adapters/llm/openai.adapter.js';
import { AnthropicAdapter } from '../../../src/adapters/llm/anthropic.adapter.js';

describe('createLLMAdapter', () => {
  it('should create OpenAI adapter for openai provider', () => {
    const adapter = createLLMAdapter('openai', { apiKey: 'test-key' });
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect(adapter.provider).toBe('openai');
  });

  it('should create Anthropic adapter for anthropic provider', () => {
    const adapter = createLLMAdapter('anthropic', { apiKey: 'test-key' });
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(adapter.provider).toBe('anthropic');
  });

  it('should throw for unknown provider', () => {
    expect(() =>
      createLLMAdapter('unknown' as LLMProvider, { apiKey: 'test-key' })
    ).toThrow('Unknown LLM provider: unknown');
  });
});

describe('getSupportedProviders', () => {
  it('should return openai and anthropic', () => {
    const providers = getSupportedProviders();

    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toHaveLength(2);
  });
});

describe('isProviderSupported', () => {
  it('should return true for openai', () => {
    expect(isProviderSupported('openai')).toBe(true);
  });

  it('should return true for anthropic', () => {
    expect(isProviderSupported('anthropic')).toBe(true);
  });

  it('should return false for unknown provider', () => {
    expect(isProviderSupported('gemini')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isProviderSupported('')).toBe(false);
  });
});
