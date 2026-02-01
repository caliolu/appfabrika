/**
 * LLM Error
 * Typed error class for LLM-related errors
 * Based on Architecture error handling standards
 */

import { LLMErrorCode } from '../../types/llm.types.js';

/**
 * User-friendly error messages in Turkish
 */
const USER_MESSAGES: Record<LLMErrorCode, string> = {
  [LLMErrorCode.TIMEOUT]: 'LLM yanıt vermedi, lütfen tekrar deneyin.',
  [LLMErrorCode.RATE_LIMIT]: 'Çok fazla istek gönderildi, lütfen biraz bekleyin.',
  [LLMErrorCode.AUTH_FAILED]: 'API anahtarı geçersiz veya süresi dolmuş.',
  [LLMErrorCode.NETWORK]: 'Bağlantı hatası oluştu, internet bağlantınızı kontrol edin.',
  [LLMErrorCode.INVALID_RESPONSE]: 'LLM beklenmedik bir yanıt döndü.',
};

/**
 * Custom error class for LLM operations
 * Provides user-friendly messages and technical details
 */
export class LLMError extends Error {
  /** Error code for programmatic handling */
  readonly code: LLMErrorCode;
  /** User-friendly message to display */
  readonly userMessage: string;
  /** Technical details for debugging (not shown to user) */
  readonly technicalDetails?: string;
  /** Whether this error is retryable */
  readonly retryable: boolean;

  constructor(
    code: LLMErrorCode,
    userMessage: string,
    technicalDetails?: string
  ) {
    super(`[${code}] ${userMessage}`);
    this.name = 'LLMError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
    this.retryable = this.isRetryable(code);

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, LLMError.prototype);
  }

  /**
   * Determines if an error is retryable based on its code
   */
  private isRetryable(code: LLMErrorCode): boolean {
    switch (code) {
      case LLMErrorCode.TIMEOUT:
      case LLMErrorCode.RATE_LIMIT:
      case LLMErrorCode.NETWORK:
        return true;
      case LLMErrorCode.AUTH_FAILED:
      case LLMErrorCode.INVALID_RESPONSE:
        return false;
      default:
        return false;
    }
  }

  /**
   * Creates a timeout error
   */
  static timeout(details?: string): LLMError {
    return new LLMError(
      LLMErrorCode.TIMEOUT,
      USER_MESSAGES[LLMErrorCode.TIMEOUT],
      details
    );
  }

  /**
   * Creates a rate limit error
   */
  static rateLimit(details?: string): LLMError {
    return new LLMError(
      LLMErrorCode.RATE_LIMIT,
      USER_MESSAGES[LLMErrorCode.RATE_LIMIT],
      details
    );
  }

  /**
   * Creates an authentication failed error
   */
  static authFailed(details?: string): LLMError {
    return new LLMError(
      LLMErrorCode.AUTH_FAILED,
      USER_MESSAGES[LLMErrorCode.AUTH_FAILED],
      details
    );
  }

  /**
   * Creates a network error
   */
  static network(details?: string): LLMError {
    return new LLMError(
      LLMErrorCode.NETWORK,
      USER_MESSAGES[LLMErrorCode.NETWORK],
      details
    );
  }

  /**
   * Creates an invalid response error
   */
  static invalidResponse(details?: string): LLMError {
    return new LLMError(
      LLMErrorCode.INVALID_RESPONSE,
      USER_MESSAGES[LLMErrorCode.INVALID_RESPONSE],
      details
    );
  }

  /**
   * Converts a generic error to an LLMError
   * Analyzes the error message to determine the appropriate code
   */
  static fromError(error: unknown): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Detect error type from message content
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return LLMError.timeout(message);
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      return LLMError.rateLimit(message);
    }
    if (
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('401') ||
      lowerMessage.includes('invalid api key') ||
      lowerMessage.includes('authentication')
    ) {
      return LLMError.authFailed(message);
    }
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('enotfound') ||
      lowerMessage.includes('fetch failed')
    ) {
      return LLMError.network(message);
    }

    // Default to invalid response for unknown errors
    return LLMError.invalidResponse(message);
  }
}
