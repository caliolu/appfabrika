/**
 * LLM Error Tests
 */

import { describe, it, expect } from 'vitest';
import { LLMError } from '../../../src/adapters/llm/llm-error.js';
import { LLMErrorCode } from '../../../src/types/llm.types.js';

describe('LLMError', () => {
  describe('constructor', () => {
    it('should create error with correct code and message', () => {
      const error = new LLMError(
        LLMErrorCode.TIMEOUT,
        'Test user message',
        'Test technical details'
      );

      expect(error.code).toBe(LLMErrorCode.TIMEOUT);
      expect(error.userMessage).toBe('Test user message');
      expect(error.technicalDetails).toBe('Test technical details');
      expect(error.name).toBe('LLMError');
    });

    it('should set retryable to true for timeout errors', () => {
      const error = new LLMError(LLMErrorCode.TIMEOUT, 'Timeout');
      expect(error.retryable).toBe(true);
    });

    it('should set retryable to true for rate limit errors', () => {
      const error = new LLMError(LLMErrorCode.RATE_LIMIT, 'Rate limit');
      expect(error.retryable).toBe(true);
    });

    it('should set retryable to true for network errors', () => {
      const error = new LLMError(LLMErrorCode.NETWORK, 'Network error');
      expect(error.retryable).toBe(true);
    });

    it('should set retryable to false for auth errors', () => {
      const error = new LLMError(LLMErrorCode.AUTH_FAILED, 'Auth failed');
      expect(error.retryable).toBe(false);
    });

    it('should set retryable to false for invalid response errors', () => {
      const error = new LLMError(LLMErrorCode.INVALID_RESPONSE, 'Invalid');
      expect(error.retryable).toBe(false);
    });
  });

  describe('factory methods', () => {
    it('should create timeout error with correct code', () => {
      const error = LLMError.timeout('Connection timed out');

      expect(error.code).toBe(LLMErrorCode.TIMEOUT);
      expect(error.userMessage).toContain('yanıt vermedi');
      expect(error.technicalDetails).toBe('Connection timed out');
    });

    it('should create rate limit error with correct code', () => {
      const error = LLMError.rateLimit('429 Too Many Requests');

      expect(error.code).toBe(LLMErrorCode.RATE_LIMIT);
      expect(error.userMessage).toContain('fazla istek');
      expect(error.technicalDetails).toBe('429 Too Many Requests');
    });

    it('should create auth failed error with correct code', () => {
      const error = LLMError.authFailed('Invalid API key');

      expect(error.code).toBe(LLMErrorCode.AUTH_FAILED);
      expect(error.userMessage).toContain('API anahtarı');
      expect(error.technicalDetails).toBe('Invalid API key');
    });

    it('should create network error with correct code', () => {
      const error = LLMError.network('ECONNREFUSED');

      expect(error.code).toBe(LLMErrorCode.NETWORK);
      expect(error.userMessage).toContain('Bağlantı hatası');
      expect(error.technicalDetails).toBe('ECONNREFUSED');
    });

    it('should create invalid response error with correct code', () => {
      const error = LLMError.invalidResponse('Unexpected format');

      expect(error.code).toBe(LLMErrorCode.INVALID_RESPONSE);
      expect(error.userMessage).toContain('beklenmedik');
      expect(error.technicalDetails).toBe('Unexpected format');
    });
  });

  describe('fromError', () => {
    it('should return same error if already LLMError', () => {
      const original = LLMError.timeout('test');
      const result = LLMError.fromError(original);

      expect(result).toBe(original);
    });

    it('should detect timeout errors from message', () => {
      const error = new Error('Request timed out');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.TIMEOUT);
    });

    it('should detect rate limit errors from message', () => {
      const error = new Error('Rate limit exceeded');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.RATE_LIMIT);
    });

    it('should detect rate limit errors from 429 status', () => {
      const error = new Error('Request failed with status 429');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.RATE_LIMIT);
    });

    it('should detect auth errors from message', () => {
      const error = new Error('Unauthorized');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.AUTH_FAILED);
    });

    it('should detect auth errors from 401 status', () => {
      const error = new Error('Request failed with status 401');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.AUTH_FAILED);
    });

    it('should detect network errors from ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.NETWORK);
    });

    it('should detect network errors from ENOTFOUND', () => {
      const error = new Error('ENOTFOUND api.openai.com');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.NETWORK);
    });

    it('should default to invalid response for unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const result = LLMError.fromError(error);

      expect(result.code).toBe(LLMErrorCode.INVALID_RESPONSE);
    });

    it('should handle non-Error objects', () => {
      const result = LLMError.fromError('String error message');

      expect(result.code).toBe(LLMErrorCode.INVALID_RESPONSE);
      expect(result.technicalDetails).toBe('String error message');
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of Error', () => {
      const error = LLMError.timeout();
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of LLMError', () => {
      const error = LLMError.timeout();
      expect(error).toBeInstanceOf(LLMError);
    });
  });
});
