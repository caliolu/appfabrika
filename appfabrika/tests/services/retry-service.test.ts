/**
 * RetryService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RetryService,
  getRetryService,
  resetRetryService,
  calculateDelay,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  RETRY_MESSAGES,
  type RetryConfig,
  type RetryEvent,
} from '../../src/services/retry-service.js';
import { LLMError } from '../../src/adapters/llm/llm-error.js';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    resetRetryService();
    retryService = new RetryService();
  });

  afterEach(() => {
    resetRetryService();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = retryService.getConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelayMs).toBe(10000);
      expect(config.maxDelayMs).toBe(60000);
      expect(config.delayStrategy).toBe('exponential');
    });

    it('should create with custom config', () => {
      const customService = new RetryService({ maxRetries: 5 });
      const config = customService.getConfig();
      expect(config.maxRetries).toBe(5);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      retryService.updateConfig({ maxRetries: 5 });
      const config = retryService.getConfig();
      expect(config.maxRetries).toBe(5);
    });

    it('should merge with existing config', () => {
      retryService.updateConfig({ maxRetries: 5 });
      retryService.updateConfig({ baseDelayMs: 5000 });
      const config = retryService.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelayMs).toBe(5000);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await retryService.withRetryNoDelay(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(LLMError.timeout('test'))
        .mockResolvedValue('success');

      const result = await retryService.withRetryNoDelay(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(LLMError.timeout('test'))
        .mockRejectedValueOnce(LLMError.network('test'))
        .mockResolvedValue('success');

      const result = await retryService.withRetryNoDelay(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(LLMError.timeout('test'));

      const result = await retryService.withRetryNoDelay(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should not retry on non-retryable error', async () => {
      const operation = vi.fn().mockRejectedValue(LLMError.authFailed('test'));

      const result = await retryService.withRetryNoDelay(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should emit events during retry', async () => {
      const events: RetryEvent[] = [];
      retryService.onEvent((event) => events.push(event));

      const operation = vi
        .fn()
        .mockRejectedValueOnce(LLMError.timeout('test'))
        .mockResolvedValue('success');

      await retryService.withRetryNoDelay(operation);

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('attempt');
      expect(events[1].type).toBe('retry');
      expect(events[2].type).toBe('attempt');
      expect(events[3].type).toBe('success');
    });

    it('should emit exhausted event when retries are exhausted', async () => {
      const events: RetryEvent[] = [];
      retryService.onEvent((event) => events.push(event));

      const operation = vi.fn().mockRejectedValue(LLMError.timeout('test'));

      await retryService.withRetryNoDelay(operation);

      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('exhausted');
    });

    it('should track total time', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryService.withRetryNoDelay(operation);

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use custom options', async () => {
      const operation = vi.fn().mockRejectedValue(LLMError.timeout('test'));

      const result = await retryService.withRetryNoDelay(operation, {
        maxRetries: 1,
      });

      expect(result.attempts).toBe(2); // 1 initial + 1 retry
    });
  });

  describe('event handling', () => {
    it('should call event handler', async () => {
      const handler = vi.fn();
      retryService.onEvent(handler);

      const operation = vi.fn().mockResolvedValue('success');
      await retryService.withRetryNoDelay(operation);

      expect(handler).toHaveBeenCalled();
    });

    it('should clear event handler', async () => {
      const handler = vi.fn();
      retryService.onEvent(handler);
      retryService.clearEventHandler();

      const operation = vi.fn().mockResolvedValue('success');
      await retryService.withRetryNoDelay(operation);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('formatRetryMessage', () => {
    it('should format message without delay', () => {
      const message = retryService.formatRetryMessage(1, 4);
      expect(message).toContain('Yeniden deneniyor');
      expect(message).toContain('1/4');
    });

    it('should format message with delay', () => {
      const message = retryService.formatRetryMessage(2, 4, 30000);
      expect(message).toContain('Bekleniyor 30 saniye');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const service1 = getRetryService();
      const service2 = getRetryService();
      expect(service1).toBe(service2);
    });

    it('should return new instance after reset', () => {
      const service1 = getRetryService();
      resetRetryService();
      const service2 = getRetryService();
      expect(service1).not.toBe(service2);
    });
  });
});

describe('calculateDelay', () => {
  it('should use custom delay sequence', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      delaySequence: [10000, 30000, 60000],
    };

    expect(calculateDelay(1, config)).toBe(10000);
    expect(calculateDelay(2, config)).toBe(30000);
    expect(calculateDelay(3, config)).toBe(60000);
  });

  it('should calculate fixed delay', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      delayStrategy: 'fixed',
      baseDelayMs: 5000,
      delaySequence: undefined,
    };

    expect(calculateDelay(1, config)).toBe(5000);
    expect(calculateDelay(2, config)).toBe(5000);
    expect(calculateDelay(3, config)).toBe(5000);
  });

  it('should calculate linear delay', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      delayStrategy: 'linear',
      baseDelayMs: 5000,
      maxDelayMs: 60000,
      delaySequence: undefined,
    };

    expect(calculateDelay(1, config)).toBe(5000);
    expect(calculateDelay(2, config)).toBe(10000);
    expect(calculateDelay(3, config)).toBe(15000);
  });

  it('should calculate exponential delay', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      delayStrategy: 'exponential',
      baseDelayMs: 5000,
      maxDelayMs: 60000,
      delaySequence: undefined,
    };

    expect(calculateDelay(1, config)).toBe(5000);
    expect(calculateDelay(2, config)).toBe(10000);
    expect(calculateDelay(3, config)).toBe(20000);
  });

  it('should cap at maxDelayMs', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      delayStrategy: 'exponential',
      baseDelayMs: 30000,
      maxDelayMs: 60000,
      delaySequence: undefined,
    };

    expect(calculateDelay(3, config)).toBe(60000); // Would be 120000 without cap
  });
});

describe('isRetryableError', () => {
  describe('LLMError instances', () => {
    it('should return true for timeout error', () => {
      expect(isRetryableError(LLMError.timeout('test'))).toBe(true);
    });

    it('should return true for rate limit error', () => {
      expect(isRetryableError(LLMError.rateLimit('test'))).toBe(true);
    });

    it('should return true for network error', () => {
      expect(isRetryableError(LLMError.network('test'))).toBe(true);
    });

    it('should return false for auth failed error', () => {
      expect(isRetryableError(LLMError.authFailed('test'))).toBe(false);
    });

    it('should return false for invalid response error', () => {
      expect(isRetryableError(LLMError.invalidResponse('test'))).toBe(false);
    });
  });

  describe('generic errors', () => {
    it('should detect timeout in error message', () => {
      expect(isRetryableError(new Error('Request timed out'))).toBe(true);
    });

    it('should detect rate limit in error message', () => {
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('Error 429'))).toBe(true);
    });

    it('should detect network error in error message', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
      expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    });

    it('should return false for unknown errors', () => {
      expect(isRetryableError(new Error('Unknown error'))).toBe(false);
    });
  });

  describe('non-Error values', () => {
    it('should return false for non-errors', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError(123)).toBe(false);
    });
  });
});

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(10000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(60000);
    expect(DEFAULT_RETRY_CONFIG.delayStrategy).toBe('exponential');
    expect(DEFAULT_RETRY_CONFIG.delaySequence).toEqual([10000, 30000, 60000]);
  });
});

describe('RETRY_MESSAGES', () => {
  it('should have Turkish messages', () => {
    expect(RETRY_MESSAGES.RETRYING).toBe('Yeniden deneniyor...');
    expect(RETRY_MESSAGES.ATTEMPT).toBe('Deneme');
    expect(RETRY_MESSAGES.WAITING).toBe('Bekleniyor');
    expect(RETRY_MESSAGES.SECONDS).toBe('saniye');
    expect(RETRY_MESSAGES.ALL_RETRIES_EXHAUSTED).toBe('Tüm denemeler tükendi');
    expect(RETRY_MESSAGES.OPERATION_SUCCEEDED).toBe('İşlem başarılı');
  });
});
