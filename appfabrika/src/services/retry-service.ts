/**
 * Retry Service
 * Handles automatic retry logic with configurable delay strategy
 * Implements Stories 7.1 and 7.2
 */

import { LLMError } from '../adapters/llm/llm-error.js';

/**
 * Retry state for tracking attempts
 */
export type RetryState = 'idle' | 'retrying' | 'succeeded' | 'failed' | 'exhausted';

/**
 * Delay strategy for retry attempts
 */
export type DelayStrategy = 'fixed' | 'linear' | 'exponential';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Delay strategy to use */
  delayStrategy: DelayStrategy;
  /** Custom delay sequence (overrides strategy) */
  delaySequence?: number[];
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result if successful */
  result?: T;
  /** The final error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTimeMs: number;
}

/**
 * Event emitted during retry operations
 */
export interface RetryEvent {
  /** Event type */
  type: 'attempt' | 'retry' | 'success' | 'failure' | 'exhausted';
  /** Current attempt number (1-based) */
  attempt: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Delay before next retry (if applicable) */
  delayMs?: number;
  /** Error that triggered the retry (if applicable) */
  error?: Error;
}

/**
 * Callback for retry events
 */
export type RetryEventHandler = (event: RetryEvent) => void;

/**
 * Default retry configuration
 * Delays: 10s, 30s, 60s per Story 7.2
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10000,
  maxDelayMs: 60000,
  delayStrategy: 'exponential',
  delaySequence: [10000, 30000, 60000], // 10s, 30s, 60s
};

/**
 * Turkish messages for retry events
 */
export const RETRY_MESSAGES = {
  RETRYING: 'Yeniden deneniyor...',
  ATTEMPT: 'Deneme',
  OF: '/',
  WAITING: 'Bekleniyor',
  SECONDS: 'saniye',
  RETRY_FAILED: 'Yeniden deneme başarısız',
  ALL_RETRIES_EXHAUSTED: 'Tüm denemeler tükendi',
  OPERATION_SUCCEEDED: 'İşlem başarılı',
} as const;

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for a given attempt based on strategy
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Use custom sequence if provided
  if (config.delaySequence && config.delaySequence.length >= attempt) {
    return config.delaySequence[attempt - 1];
  }

  let delay: number;

  switch (config.delayStrategy) {
    case 'fixed':
      delay = config.baseDelayMs;
      break;
    case 'linear':
      delay = config.baseDelayMs * attempt;
      break;
    case 'exponential':
      delay = config.baseDelayMs * Math.pow(2, attempt - 1);
      break;
    default:
      delay = config.baseDelayMs;
  }

  return Math.min(delay, config.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMError) {
    return error.retryable;
  }

  // Check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed')
    );
  }

  return false;
}

/**
 * Retry Service for automatic retry with delay strategy
 */
export class RetryService {
  private config: RetryConfig;
  private eventHandler?: RetryEventHandler;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
    };
  }

  /**
   * Set event handler for retry events
   */
  onEvent(handler: RetryEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Clear event handler
   */
  clearEventHandler(): void {
    this.eventHandler = undefined;
  }

  /**
   * Emit a retry event
   */
  private emit(event: RetryEvent): void {
    if (this.eventHandler) {
      this.eventHandler(event);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Execute an operation with automatic retry
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...options };
    const maxAttempts = config.maxRetries + 1; // Include initial attempt
    const startTime = Date.now();

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.emit({
        type: 'attempt',
        attempt,
        maxAttempts,
      });

      try {
        const result = await operation();

        this.emit({
          type: 'success',
          attempt,
          maxAttempts,
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const isLastAttempt = attempt === maxAttempts;
        const canRetry = isRetryableError(error) && !isLastAttempt;

        if (!canRetry) {
          this.emit({
            type: isLastAttempt ? 'exhausted' : 'failure',
            attempt,
            maxAttempts,
            error: lastError,
          });

          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTimeMs: Date.now() - startTime,
          };
        }

        // Calculate delay before retry
        const delayMs = calculateDelay(attempt, config);

        this.emit({
          type: 'retry',
          attempt,
          maxAttempts,
          delayMs,
          error: lastError,
        });

        // Wait before next attempt
        await sleep(delayMs);
      }
    }

    // Should not reach here, but handle edge case
    return {
      success: false,
      error: lastError,
      attempts: maxAttempts,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute operation without delay between retries (for testing)
   */
  async withRetryNoDelay<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.withRetry(operation, {
      ...options,
      delaySequence: [0, 0, 0],
    });
  }

  /**
   * Format retry status message in Turkish
   */
  formatRetryMessage(attempt: number, maxAttempts: number, delayMs?: number): string {
    const parts = [
      RETRY_MESSAGES.RETRYING,
      `${RETRY_MESSAGES.ATTEMPT} ${attempt}${RETRY_MESSAGES.OF}${maxAttempts}`,
    ];

    if (delayMs !== undefined) {
      const seconds = Math.round(delayMs / 1000);
      parts.push(`${RETRY_MESSAGES.WAITING} ${seconds} ${RETRY_MESSAGES.SECONDS}`);
    }

    return parts.join(' - ');
  }
}

// Singleton instance
let retryServiceInstance: RetryService | null = null;

/**
 * Get the singleton RetryService instance
 */
export function getRetryService(config?: Partial<RetryConfig>): RetryService {
  if (!retryServiceInstance) {
    retryServiceInstance = new RetryService(config);
  }
  return retryServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRetryService(): void {
  retryServiceInstance = null;
}
