/**
 * Spinner Service
 * Wraps ora spinner with typed interface for BMAD workflow display
 */

import ora, { type Ora } from 'ora';
import {
  BmadStepType,
  BMAD_STEP_NAMES,
  BMAD_STEP_EMOJIS,
  BMAD_STEP_DESCRIPTIONS,
} from '../../types/bmad.types.js';

/**
 * Spinner state types
 */
export type SpinnerState = 'idle' | 'spinning' | 'succeeded' | 'failed' | 'warned';

/**
 * Turkish messages for spinner
 */
export const SPINNER_MESSAGES = {
  STEP_COMPLETED: 'tamamlandı',
  STEP_FAILED: 'başarısız',
  STEP_SKIPPED: 'atlandı',
  WAITING_FOR_INPUT: 'Kullanıcı girdisi bekleniyor...',
  PROCESSING: 'İşleniyor...',
  CONNECTING: 'Bağlanıyor...',
  RETRYING: 'Yeniden deneniyor...',
} as const;

/**
 * Spinner configuration options
 */
export interface SpinnerOptions {
  /** Show spinner (default: true in TTY, false otherwise) */
  enabled?: boolean;
  /** Spinner color */
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
  /** Hide cursor while spinning */
  hideCursor?: boolean;
}

/**
 * Spinner Service for BMAD workflow display
 * Provides a typed wrapper around ora spinner
 */
export class SpinnerService {
  private spinner: Ora | null = null;
  private currentStepId: BmadStepType | null = null;
  private state: SpinnerState = 'idle';
  private enabled: boolean;

  constructor(options?: SpinnerOptions) {
    this.enabled = options?.enabled ?? process.stdout.isTTY ?? false;
  }

  /**
   * Get current spinner state
   */
  getState(): SpinnerState {
    return this.state;
  }

  /**
   * Get current step being displayed
   */
  getCurrentStepId(): BmadStepType | null {
    return this.currentStepId;
  }

  /**
   * Check if spinner is currently active
   */
  isSpinning(): boolean {
    return this.state === 'spinning';
  }

  /**
   * Start spinner for a BMAD step
   * Shows: "💡 Proje fikrini analiz ediyor..."
   */
  startStep(stepId: BmadStepType): void {
    if (!this.enabled) return;

    this.stop();

    this.currentStepId = stepId;
    const emoji = BMAD_STEP_EMOJIS[stepId];
    const description = BMAD_STEP_DESCRIPTIONS[stepId];
    const text = `${emoji} ${description}`;

    this.spinner = ora({
      text,
      color: 'cyan',
      hideCursor: true,
    }).start();

    this.state = 'spinning';
  }

  /**
   * Start spinner with custom text
   */
  start(text: string): void {
    if (!this.enabled) return;

    this.stop();

    this.spinner = ora({
      text,
      color: 'cyan',
      hideCursor: true,
    }).start();

    this.state = 'spinning';
  }

  /**
   * Update spinner text while spinning
   */
  updateText(text: string): void {
    if (!this.enabled || !this.spinner) return;
    this.spinner.text = text;
  }

  /**
   * Mark current step as successful
   * Shows: "✓ 💡 Fikir Geliştirme tamamlandı"
   */
  succeedStep(customMessage?: string): void {
    if (!this.enabled || !this.spinner) return;

    const stepId = this.currentStepId;
    if (stepId) {
      const emoji = BMAD_STEP_EMOJIS[stepId];
      const name = BMAD_STEP_NAMES[stepId];
      const message = customMessage ?? SPINNER_MESSAGES.STEP_COMPLETED;
      this.spinner.succeed(`${emoji} ${name} ${message}`);
    } else {
      this.spinner.succeed(customMessage);
    }

    this.state = 'succeeded';
    this.currentStepId = null;
  }

  /**
   * Mark spinner as successful with custom text
   */
  succeed(text?: string): void {
    if (!this.enabled || !this.spinner) return;
    this.spinner.succeed(text);
    this.state = 'succeeded';
    this.currentStepId = null;
  }

  /**
   * Mark current step as failed
   * Shows: "✗ 💡 Fikir Geliştirme başarısız: Hata mesajı"
   */
  failStep(errorMessage?: string): void {
    if (!this.enabled || !this.spinner) return;

    const stepId = this.currentStepId;
    if (stepId) {
      const emoji = BMAD_STEP_EMOJIS[stepId];
      const name = BMAD_STEP_NAMES[stepId];
      const suffix = errorMessage ? `: ${errorMessage}` : '';
      this.spinner.fail(`${emoji} ${name} ${SPINNER_MESSAGES.STEP_FAILED}${suffix}`);
    } else {
      this.spinner.fail(errorMessage);
    }

    this.state = 'failed';
    this.currentStepId = null;
  }

  /**
   * Mark spinner as failed with custom text
   */
  fail(text?: string): void {
    if (!this.enabled || !this.spinner) return;
    this.spinner.fail(text);
    this.state = 'failed';
    this.currentStepId = null;
  }

  /**
   * Mark current step as skipped
   * Shows: "○ 💡 Fikir Geliştirme atlandı"
   */
  skipStep(): void {
    if (!this.enabled || !this.spinner) return;

    const stepId = this.currentStepId;
    if (stepId) {
      const emoji = BMAD_STEP_EMOJIS[stepId];
      const name = BMAD_STEP_NAMES[stepId];
      this.spinner.warn(`${emoji} ${name} ${SPINNER_MESSAGES.STEP_SKIPPED}`);
    } else {
      this.spinner.warn();
    }

    this.state = 'warned';
    this.currentStepId = null;
  }

  /**
   * Show warning with spinner
   */
  warn(text?: string): void {
    if (!this.enabled || !this.spinner) return;
    this.spinner.warn(text);
    this.state = 'warned';
    this.currentStepId = null;
  }

  /**
   * Stop spinner without any indicator
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    this.state = 'idle';
    this.currentStepId = null;
  }

  /**
   * Get formatted text for a step
   */
  getStepText(stepId: BmadStepType): string {
    const emoji = BMAD_STEP_EMOJIS[stepId];
    const description = BMAD_STEP_DESCRIPTIONS[stepId];
    return `${emoji} ${description}`;
  }

  /**
   * Get formatted success text for a step
   */
  getSuccessText(stepId: BmadStepType): string {
    const emoji = BMAD_STEP_EMOJIS[stepId];
    const name = BMAD_STEP_NAMES[stepId];
    return `${emoji} ${name} ${SPINNER_MESSAGES.STEP_COMPLETED}`;
  }

  /**
   * Get formatted failure text for a step
   */
  getFailureText(stepId: BmadStepType, errorMessage?: string): string {
    const emoji = BMAD_STEP_EMOJIS[stepId];
    const name = BMAD_STEP_NAMES[stepId];
    const suffix = errorMessage ? `: ${errorMessage}` : '';
    return `${emoji} ${name} ${SPINNER_MESSAGES.STEP_FAILED}${suffix}`;
  }

  /**
   * Enable or disable spinner
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if spinner is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let spinnerServiceInstance: SpinnerService | null = null;

/**
 * Get the singleton SpinnerService instance
 */
export function getSpinnerService(options?: SpinnerOptions): SpinnerService {
  if (!spinnerServiceInstance) {
    spinnerServiceInstance = new SpinnerService(options);
  }
  return spinnerServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSpinnerService(): void {
  if (spinnerServiceInstance) {
    spinnerServiceInstance.stop();
  }
  spinnerServiceInstance = null;
}
