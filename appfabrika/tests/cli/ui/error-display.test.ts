/**
 * ErrorDisplay Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorDisplay,
  getErrorDisplay,
  resetErrorDisplay,
  ErrorAction,
  ERROR_MESSAGES,
  ERROR_LABELS,
  DEFAULT_ACTIONS,
  EXTENDED_ACTIONS,
} from '../../../src/cli/ui/error-display.js';
import { LLMError } from '../../../src/adapters/llm/llm-error.js';
import { LLMErrorCode } from '../../../src/types/llm.types.js';
import { COLORS } from '../../../src/cli/ui/terminal-ui.js';

describe('ErrorDisplay', () => {
  let errorDisplay: ErrorDisplay;

  beforeEach(() => {
    resetErrorDisplay();
    errorDisplay = new ErrorDisplay({ colorEnabled: false });
  });

  afterEach(() => {
    resetErrorDisplay();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const display = new ErrorDisplay();
      expect(display.isColorEnabled()).toBe(true);
    });

    it('should create with colors disabled', () => {
      const display = new ErrorDisplay({ colorEnabled: false });
      expect(display.isColorEnabled()).toBe(false);
    });
  });

  describe('getErrorInfo', () => {
    it('should extract info from LLMError', () => {
      const error = LLMError.timeout('Technical details here');
      const info = errorDisplay.getErrorInfo(error);

      expect(info.message).toBe('LLM yanıt vermedi, lütfen tekrar deneyin.');
      expect(info.code).toBe(LLMErrorCode.TIMEOUT);
      expect(info.technicalDetails).toBe('Technical details here');
      expect(info.retryable).toBe(true);
    });

    it('should extract info from generic Error', () => {
      const error = new Error('Something went wrong');
      const info = errorDisplay.getErrorInfo(error);

      expect(info.message).toBe('Something went wrong');
      expect(info.retryable).toBe(false);
    });

    it('should handle unknown error types', () => {
      const info = errorDisplay.getErrorInfo('string error');

      expect(info.message).toBe(ERROR_LABELS.UNKNOWN_ERROR);
      expect(info.retryable).toBe(false);
    });

    it('should include retry counts when provided', () => {
      const error = new Error('test');
      const info = errorDisplay.getErrorInfo(error, 3, 4);

      expect(info.retryAttempts).toBe(3);
      expect(info.maxRetries).toBe(4);
    });
  });

  describe('formatHeader', () => {
    it('should format header without colors', () => {
      const result = errorDisplay.formatHeader();
      expect(result).toBe('❌ Hata Oluştu');
    });

    it('should format header with colors', () => {
      const colorDisplay = new ErrorDisplay({ colorEnabled: true });
      const result = colorDisplay.formatHeader();
      expect(result).toContain(COLORS.BOLD);
      expect(result).toContain(COLORS.YELLOW);
      expect(result).toContain('Hata Oluştu');
    });
  });

  describe('formatMessage', () => {
    it('should format message with indent', () => {
      const info = { message: 'Test error message' };
      const result = errorDisplay.formatMessage(info as any);
      expect(result).toBe('   Test error message');
    });
  });

  describe('formatRetryCount', () => {
    it('should format retry count', () => {
      const result = errorDisplay.formatRetryCount(3, 4);
      expect(result).toContain('Denemeler: 3/4');
      expect(result).toContain('başarısız');
    });
  });

  describe('formatActions', () => {
    it('should format default actions', () => {
      const result = errorDisplay.formatActions();
      expect(result).toContain('[R] Yeniden Dene');
      expect(result).toContain('[S] İlerlemeyi Kaydet');
      expect(result).toContain('[?] Yardım');
    });

    it('should format custom actions', () => {
      const actions = [
        { action: ErrorAction.RETRY, key: 'R', label: 'Test' },
      ];
      const result = errorDisplay.formatActions(actions);
      expect(result).toContain('[R] Test');
    });

    it('should include colors when enabled', () => {
      const colorDisplay = new ErrorDisplay({ colorEnabled: true });
      const result = colorDisplay.formatActions();
      expect(result).toContain(COLORS.CYAN);
    });
  });

  describe('formatTechnicalDetails', () => {
    it('should format technical details', () => {
      const result = errorDisplay.formatTechnicalDetails('Error stack here');
      expect(result).toContain('Teknik Detaylar:');
      expect(result).toContain('Error stack here');
    });
  });

  describe('render', () => {
    it('should render full error display', () => {
      const error = LLMError.timeout('test');
      const result = errorDisplay.render(error, {
        retryAttempts: 3,
        maxRetries: 3,
      });

      expect(result).toContain('❌ Hata Oluştu');
      expect(result).toContain('LLM yanıt vermedi');
      expect(result).toContain('Denemeler: 3/3');
      expect(result).toContain('Ne yapabilirsiniz:');
      expect(result).toContain('[R] Yeniden Dene');
    });

    it('should hide actions when showActions is false', () => {
      const error = new Error('test');
      const result = errorDisplay.render(error, {
        showActions: false,
      });

      expect(result).not.toContain('Ne yapabilirsiniz');
      expect(result).not.toContain('[R]');
    });

    it('should show technical details when enabled', () => {
      const error = LLMError.timeout('Stack trace here');
      const result = errorDisplay.render(error, {
        showTechnicalDetails: true,
      });

      expect(result).toContain('Teknik Detaylar');
      expect(result).toContain('Stack trace here');
    });

    it('should use custom actions', () => {
      const error = new Error('test');
      const result = errorDisplay.render(error, {
        actions: EXTENDED_ACTIONS,
      });

      expect(result).toContain('[K] Bu Adımı Atla');
      expect(result).toContain('[Q] İptal');
    });
  });

  describe('renderSimple', () => {
    it('should render simple error message', () => {
      const error = new Error('Simple error');
      const result = errorDisplay.renderSimple(error);
      expect(result).toBe('❌ Simple error');
    });

    it('should render LLMError user message', () => {
      const error = LLMError.rateLimit('details');
      const result = errorDisplay.renderSimple(error);
      expect(result).toBe('❌ Çok fazla istek gönderildi, lütfen biraz bekleyin.');
    });
  });

  describe('renderRetryExhausted', () => {
    it('should render retry exhausted message', () => {
      const error = LLMError.network('test');
      const result = errorDisplay.renderRetryExhausted(error, 3, 3);

      expect(result).toContain('Hata Oluştu');
      expect(result).toContain('Denemeler: 3/3');
      expect(result).toContain('[R] Yeniden Dene');
      expect(result).toContain('[S] İlerlemeyi Kaydet');
    });
  });

  describe('color management', () => {
    it('should enable colors', () => {
      errorDisplay.setColorEnabled(true);
      expect(errorDisplay.isColorEnabled()).toBe(true);
    });

    it('should disable colors', () => {
      const display = new ErrorDisplay({ colorEnabled: true });
      display.setColorEnabled(false);
      expect(display.isColorEnabled()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const display1 = getErrorDisplay();
      const display2 = getErrorDisplay();
      expect(display1).toBe(display2);
    });

    it('should return new instance after reset', () => {
      const display1 = getErrorDisplay();
      resetErrorDisplay();
      const display2 = getErrorDisplay();
      expect(display1).not.toBe(display2);
    });
  });
});

describe('ERROR_MESSAGES constant', () => {
  it('should have Turkish messages for all error codes', () => {
    expect(ERROR_MESSAGES[LLMErrorCode.TIMEOUT]).toContain('LLM yanıt vermedi');
    expect(ERROR_MESSAGES[LLMErrorCode.RATE_LIMIT]).toContain('Çok fazla istek');
    expect(ERROR_MESSAGES[LLMErrorCode.AUTH_FAILED]).toContain('API anahtarı');
    expect(ERROR_MESSAGES[LLMErrorCode.NETWORK]).toContain('Bağlantı hatası');
    expect(ERROR_MESSAGES[LLMErrorCode.INVALID_RESPONSE]).toContain('Beklenmedik');
  });
});

describe('ERROR_LABELS constant', () => {
  it('should have all Turkish labels', () => {
    expect(ERROR_LABELS.ERROR_OCCURRED).toBe('Hata Oluştu');
    expect(ERROR_LABELS.ATTEMPTS).toBe('Denemeler');
    expect(ERROR_LABELS.FAILED).toBe('başarısız');
    expect(ERROR_LABELS.WHAT_YOU_CAN_DO).toBe('Ne yapabilirsiniz');
    expect(ERROR_LABELS.RETRY).toBe('Yeniden Dene');
    expect(ERROR_LABELS.SAVE_PROGRESS).toBe('İlerlemeyi Kaydet');
    expect(ERROR_LABELS.HELP).toBe('Yardım');
    expect(ERROR_LABELS.SKIP_STEP).toBe('Bu Adımı Atla');
    expect(ERROR_LABELS.ABORT).toBe('İptal');
  });
});

describe('DEFAULT_ACTIONS constant', () => {
  it('should have retry, save, help actions', () => {
    expect(DEFAULT_ACTIONS).toHaveLength(3);
    expect(DEFAULT_ACTIONS[0].action).toBe(ErrorAction.RETRY);
    expect(DEFAULT_ACTIONS[0].key).toBe('R');
    expect(DEFAULT_ACTIONS[1].action).toBe(ErrorAction.SAVE);
    expect(DEFAULT_ACTIONS[1].key).toBe('S');
    expect(DEFAULT_ACTIONS[2].action).toBe(ErrorAction.HELP);
    expect(DEFAULT_ACTIONS[2].key).toBe('?');
  });
});

describe('EXTENDED_ACTIONS constant', () => {
  it('should have retry, skip, save, abort actions', () => {
    expect(EXTENDED_ACTIONS).toHaveLength(4);
    expect(EXTENDED_ACTIONS.find(a => a.action === ErrorAction.SKIP)).toBeDefined();
    expect(EXTENDED_ACTIONS.find(a => a.action === ErrorAction.ABORT)).toBeDefined();
  });
});

describe('ErrorAction enum', () => {
  it('should have all action types', () => {
    expect(ErrorAction.RETRY).toBe('retry');
    expect(ErrorAction.SAVE).toBe('save');
    expect(ErrorAction.HELP).toBe('help');
    expect(ErrorAction.SKIP).toBe('skip');
    expect(ErrorAction.ABORT).toBe('abort');
  });
});
