/**
 * Error Display Service
 * Handles user-friendly error message display with action options
 * Implements Story 7.3
 */

import { LLMError } from '../../adapters/llm/llm-error.js';
import { LLMErrorCode } from '../../types/llm.types.js';
import { COLORS } from './terminal-ui.js';

/**
 * Error action options
 */
export enum ErrorAction {
  RETRY = 'retry',
  SAVE = 'save',
  HELP = 'help',
  SKIP = 'skip',
  ABORT = 'abort',
}

/**
 * Error display configuration
 */
export interface ErrorDisplayConfig {
  /** Show action options */
  showActions?: boolean;
  /** Show retry count */
  showRetryCount?: boolean;
  /** Show technical details */
  showTechnicalDetails?: boolean;
  /** Enable colors */
  colorEnabled?: boolean;
}

/**
 * Error information for display
 */
export interface ErrorInfo {
  /** User-friendly error message */
  message: string;
  /** Error code for categorization */
  code?: string;
  /** Technical details (for debugging) */
  technicalDetails?: string;
  /** Number of retry attempts made */
  retryAttempts?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether error is retryable */
  retryable?: boolean;
}

/**
 * Action option for display
 */
export interface ActionOption {
  /** Action type */
  action: ErrorAction;
  /** Keyboard shortcut */
  key: string;
  /** Display label in Turkish */
  label: string;
}

/**
 * Turkish error messages by error code
 */
export const ERROR_MESSAGES: Record<LLMErrorCode, string> = {
  [LLMErrorCode.TIMEOUT]: 'LLM yanıt vermedi. İnternet bağlantınızı kontrol edin.',
  [LLMErrorCode.RATE_LIMIT]: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
  [LLMErrorCode.AUTH_FAILED]: 'API anahtarı geçersiz. Ayarlarınızı kontrol edin.',
  [LLMErrorCode.NETWORK]: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.',
  [LLMErrorCode.INVALID_RESPONSE]: 'Beklenmedik bir yanıt alındı. Lütfen tekrar deneyin.',
};

/**
 * Turkish labels for error display
 */
export const ERROR_LABELS = {
  ERROR_OCCURRED: 'Hata Oluştu',
  ATTEMPTS: 'Denemeler',
  FAILED: 'başarısız',
  WHAT_YOU_CAN_DO: 'Ne yapabilirsiniz',
  RETRY: 'Yeniden Dene',
  SAVE_PROGRESS: 'İlerlemeyi Kaydet',
  HELP: 'Yardım',
  SKIP_STEP: 'Bu Adımı Atla',
  ABORT: 'İptal',
  TECHNICAL_DETAILS: 'Teknik Detaylar',
  UNKNOWN_ERROR: 'Bilinmeyen bir hata oluştu.',
} as const;

/**
 * Default action options
 */
export const DEFAULT_ACTIONS: ActionOption[] = [
  { action: ErrorAction.RETRY, key: 'R', label: ERROR_LABELS.RETRY },
  { action: ErrorAction.SAVE, key: 'S', label: ERROR_LABELS.SAVE_PROGRESS },
  { action: ErrorAction.HELP, key: '?', label: ERROR_LABELS.HELP },
];

/**
 * Extended action options (includes skip and abort)
 */
export const EXTENDED_ACTIONS: ActionOption[] = [
  { action: ErrorAction.RETRY, key: 'R', label: ERROR_LABELS.RETRY },
  { action: ErrorAction.SKIP, key: 'K', label: ERROR_LABELS.SKIP_STEP },
  { action: ErrorAction.SAVE, key: 'S', label: ERROR_LABELS.SAVE_PROGRESS },
  { action: ErrorAction.ABORT, key: 'Q', label: ERROR_LABELS.ABORT },
];

/**
 * Error Display Service
 */
export class ErrorDisplay {
  private colorEnabled: boolean;

  constructor(config?: ErrorDisplayConfig) {
    this.colorEnabled = config?.colorEnabled ?? true;
  }

  /**
   * Get error info from various error types
   */
  getErrorInfo(error: unknown, retryAttempts?: number, maxRetries?: number): ErrorInfo {
    if (error instanceof LLMError) {
      return {
        message: error.userMessage,
        code: error.code,
        technicalDetails: error.technicalDetails,
        retryAttempts,
        maxRetries,
        retryable: error.retryable,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        technicalDetails: error.stack,
        retryAttempts,
        maxRetries,
        retryable: false,
      };
    }

    return {
      message: ERROR_LABELS.UNKNOWN_ERROR,
      retryAttempts,
      maxRetries,
      retryable: false,
    };
  }

  /**
   * Format error header
   */
  formatHeader(): string {
    const icon = '❌';
    const text = ERROR_LABELS.ERROR_OCCURRED;
    return this.colorEnabled
      ? `${COLORS.BOLD}${COLORS.YELLOW}${icon} ${text}${COLORS.RESET}`
      : `${icon} ${text}`;
  }

  /**
   * Format error message
   */
  formatMessage(info: ErrorInfo): string {
    const indent = '   ';
    return `${indent}${info.message}`;
  }

  /**
   * Format retry count
   */
  formatRetryCount(attempts: number, maxRetries: number): string {
    const indent = '   ';
    const failed = this.colorEnabled
      ? `${COLORS.YELLOW}${ERROR_LABELS.FAILED}${COLORS.RESET}`
      : ERROR_LABELS.FAILED;
    return `${indent}${ERROR_LABELS.ATTEMPTS}: ${attempts}/${maxRetries} ${failed}`;
  }

  /**
   * Format action options
   */
  formatActions(actions: ActionOption[] = DEFAULT_ACTIONS): string {
    const indent = '   ';
    const options = actions.map((opt) => {
      const key = this.colorEnabled
        ? `${COLORS.CYAN}[${opt.key}]${COLORS.RESET}`
        : `[${opt.key}]`;
      return `${key} ${opt.label}`;
    });
    return `${indent}${options.join(' | ')}`;
  }

  /**
   * Format technical details (for debugging)
   */
  formatTechnicalDetails(details: string): string {
    const indent = '   ';
    const header = this.colorEnabled
      ? `${COLORS.DIM}${ERROR_LABELS.TECHNICAL_DETAILS}:${COLORS.RESET}`
      : `${ERROR_LABELS.TECHNICAL_DETAILS}:`;
    const content = this.colorEnabled
      ? `${COLORS.DIM}${details}${COLORS.RESET}`
      : details;
    return `${indent}${header}\n${indent}${content}`;
  }

  /**
   * Render full error display
   */
  render(
    error: unknown,
    options?: {
      retryAttempts?: number;
      maxRetries?: number;
      showActions?: boolean;
      showTechnicalDetails?: boolean;
      actions?: ActionOption[];
    }
  ): string {
    const info = this.getErrorInfo(error, options?.retryAttempts, options?.maxRetries);
    const lines: string[] = [];

    // Header
    lines.push(this.formatHeader());
    lines.push('');

    // Error message
    lines.push(this.formatMessage(info));
    lines.push('');

    // Retry count (if applicable)
    if (info.retryAttempts !== undefined && info.maxRetries !== undefined) {
      lines.push(this.formatRetryCount(info.retryAttempts, info.maxRetries));
      lines.push('');
    }

    // Technical details (if enabled and available)
    if (options?.showTechnicalDetails && info.technicalDetails) {
      lines.push(this.formatTechnicalDetails(info.technicalDetails));
      lines.push('');
    }

    // Action options (if enabled)
    if (options?.showActions !== false) {
      const actionsHeader = this.colorEnabled
        ? `   ${COLORS.BOLD}${ERROR_LABELS.WHAT_YOU_CAN_DO}:${COLORS.RESET}`
        : `   ${ERROR_LABELS.WHAT_YOU_CAN_DO}:`;
      lines.push(actionsHeader);
      lines.push(this.formatActions(options?.actions));
    }

    return lines.join('\n');
  }

  /**
   * Render simple error message (no actions)
   */
  renderSimple(error: unknown): string {
    const info = this.getErrorInfo(error);
    return `❌ ${info.message}`;
  }

  /**
   * Render error with retry exhausted message
   */
  renderRetryExhausted(
    error: unknown,
    attempts: number,
    maxRetries: number
  ): string {
    return this.render(error, {
      retryAttempts: attempts,
      maxRetries,
      showActions: true,
      actions: DEFAULT_ACTIONS,
    });
  }

  /**
   * Enable or disable colors
   */
  setColorEnabled(enabled: boolean): void {
    this.colorEnabled = enabled;
  }

  /**
   * Check if colors are enabled
   */
  isColorEnabled(): boolean {
    return this.colorEnabled;
  }
}

// Singleton instance
let errorDisplayInstance: ErrorDisplay | null = null;

/**
 * Get the singleton ErrorDisplay instance
 */
export function getErrorDisplay(config?: ErrorDisplayConfig): ErrorDisplay {
  if (!errorDisplayInstance) {
    errorDisplayInstance = new ErrorDisplay(config);
  }
  return errorDisplayInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetErrorDisplay(): void {
  errorDisplayInstance = null;
}
