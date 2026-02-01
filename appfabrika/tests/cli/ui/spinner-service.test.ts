/**
 * SpinnerService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SpinnerService,
  getSpinnerService,
  resetSpinnerService,
  SPINNER_MESSAGES,
} from '../../../src/cli/ui/spinner-service.js';
import { BmadStepType, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS, BMAD_STEP_DESCRIPTIONS } from '../../../src/types/bmad.types.js';

describe('SpinnerService', () => {
  let spinnerService: SpinnerService;

  beforeEach(() => {
    resetSpinnerService();
    // Create with enabled: false to avoid actual terminal output in tests
    spinnerService = new SpinnerService({ enabled: false });
  });

  afterEach(() => {
    resetSpinnerService();
  });

  describe('constructor', () => {
    it('should create spinner service with default options', () => {
      const service = new SpinnerService();
      expect(service.getState()).toBe('idle');
      expect(service.getCurrentStepId()).toBeNull();
    });

    it('should create spinner service with enabled: false', () => {
      const service = new SpinnerService({ enabled: false });
      expect(service.isEnabled()).toBe(false);
    });

    it('should create spinner service with enabled: true', () => {
      const service = new SpinnerService({ enabled: true });
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return idle state initially', () => {
      expect(spinnerService.getState()).toBe('idle');
    });
  });

  describe('getCurrentStepId', () => {
    it('should return null when no step is active', () => {
      expect(spinnerService.getCurrentStepId()).toBeNull();
    });
  });

  describe('isSpinning', () => {
    it('should return false when idle', () => {
      expect(spinnerService.isSpinning()).toBe(false);
    });
  });

  describe('startStep', () => {
    it('should not start spinner when disabled', () => {
      spinnerService.startStep(BmadStepType.BRAINSTORMING);
      // When disabled, spinner doesn't actually start
      expect(spinnerService.getState()).toBe('idle');
    });

    it('should start spinner when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      expect(enabledService.getState()).toBe('spinning');
      expect(enabledService.getCurrentStepId()).toBe(BmadStepType.BRAINSTORMING);
      enabledService.stop();
    });
  });

  describe('start', () => {
    it('should not start spinner when disabled', () => {
      spinnerService.start('Test message');
      expect(spinnerService.getState()).toBe('idle');
    });

    it('should start spinner with custom text when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.start('Custom message');
      expect(enabledService.getState()).toBe('spinning');
      enabledService.stop();
    });
  });

  describe('stop', () => {
    it('should stop spinner and reset state', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      enabledService.stop();
      expect(enabledService.getState()).toBe('idle');
      expect(enabledService.getCurrentStepId()).toBeNull();
    });
  });

  describe('succeedStep', () => {
    it('should mark step as succeeded when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      enabledService.succeedStep();
      expect(enabledService.getState()).toBe('succeeded');
      expect(enabledService.getCurrentStepId()).toBeNull();
    });

    it('should do nothing when disabled', () => {
      spinnerService.startStep(BmadStepType.BRAINSTORMING);
      spinnerService.succeedStep();
      expect(spinnerService.getState()).toBe('idle');
    });
  });

  describe('failStep', () => {
    it('should mark step as failed when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      enabledService.failStep('Test error');
      expect(enabledService.getState()).toBe('failed');
      expect(enabledService.getCurrentStepId()).toBeNull();
    });

    it('should do nothing when disabled', () => {
      spinnerService.startStep(BmadStepType.BRAINSTORMING);
      spinnerService.failStep('Test error');
      expect(spinnerService.getState()).toBe('idle');
    });
  });

  describe('skipStep', () => {
    it('should mark step as warned (skipped) when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      enabledService.skipStep();
      expect(enabledService.getState()).toBe('warned');
      expect(enabledService.getCurrentStepId()).toBeNull();
    });
  });

  describe('getStepText', () => {
    it('should return formatted step text', () => {
      const text = spinnerService.getStepText(BmadStepType.BRAINSTORMING);
      expect(text).toBe('💡 Proje fikrini analiz ediyor...');
    });

    it('should return correct text for research step', () => {
      const text = spinnerService.getStepText(BmadStepType.RESEARCH);
      expect(text).toBe('🔍 Pazar ve teknik araştırma yapıyor...');
    });

    it('should return correct text for all steps', () => {
      expect(spinnerService.getStepText(BmadStepType.PRODUCT_BRIEF)).toContain('📋');
      expect(spinnerService.getStepText(BmadStepType.PRD)).toContain('📄');
      expect(spinnerService.getStepText(BmadStepType.UX_DESIGN)).toContain('🎨');
      expect(spinnerService.getStepText(BmadStepType.ARCHITECTURE)).toContain('🏗️');
      expect(spinnerService.getStepText(BmadStepType.EPICS_STORIES)).toContain('📝');
      expect(spinnerService.getStepText(BmadStepType.SPRINT_PLANNING)).toContain('📅');
      expect(spinnerService.getStepText(BmadStepType.TECH_SPEC)).toContain('🔧');
      expect(spinnerService.getStepText(BmadStepType.DEVELOPMENT)).toContain('💻');
      expect(spinnerService.getStepText(BmadStepType.CODE_REVIEW)).toContain('🔎');
      expect(spinnerService.getStepText(BmadStepType.QA_TESTING)).toContain('✅');
    });
  });

  describe('getSuccessText', () => {
    it('should return formatted success text', () => {
      const text = spinnerService.getSuccessText(BmadStepType.BRAINSTORMING);
      expect(text).toBe('💡 Fikir Geliştirme tamamlandı');
    });

    it('should return correct success text for research step', () => {
      const text = spinnerService.getSuccessText(BmadStepType.RESEARCH);
      expect(text).toBe('🔍 Araştırma tamamlandı');
    });
  });

  describe('getFailureText', () => {
    it('should return formatted failure text without error', () => {
      const text = spinnerService.getFailureText(BmadStepType.BRAINSTORMING);
      expect(text).toBe('💡 Fikir Geliştirme başarısız');
    });

    it('should return formatted failure text with error', () => {
      const text = spinnerService.getFailureText(BmadStepType.BRAINSTORMING, 'API hatası');
      expect(text).toBe('💡 Fikir Geliştirme başarısız: API hatası');
    });
  });

  describe('setEnabled', () => {
    it('should enable spinner', () => {
      spinnerService.setEnabled(true);
      expect(spinnerService.isEnabled()).toBe(true);
    });

    it('should disable spinner', () => {
      const enabledService = new SpinnerService({ enabled: true });
      enabledService.setEnabled(false);
      expect(enabledService.isEnabled()).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return false when disabled', () => {
      expect(spinnerService.isEnabled()).toBe(false);
    });

    it('should return true when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });
      expect(enabledService.isEnabled()).toBe(true);
      enabledService.stop();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      resetSpinnerService();
      const spinner1 = getSpinnerService({ enabled: false });
      const spinner2 = getSpinnerService({ enabled: false });
      expect(spinner1).toBe(spinner2);
    });

    it('should return new instance after reset', () => {
      const spinner1 = getSpinnerService({ enabled: false });
      resetSpinnerService();
      const spinner2 = getSpinnerService({ enabled: false });
      expect(spinner1).not.toBe(spinner2);
    });
  });

  describe('SPINNER_MESSAGES constant', () => {
    it('should have Turkish messages', () => {
      expect(SPINNER_MESSAGES.STEP_COMPLETED).toBe('tamamlandı');
      expect(SPINNER_MESSAGES.STEP_FAILED).toBe('başarısız');
      expect(SPINNER_MESSAGES.STEP_SKIPPED).toBe('atlandı');
      expect(SPINNER_MESSAGES.WAITING_FOR_INPUT).toBe('Kullanıcı girdisi bekleniyor...');
      expect(SPINNER_MESSAGES.PROCESSING).toBe('İşleniyor...');
      expect(SPINNER_MESSAGES.CONNECTING).toBe('Bağlanıyor...');
      expect(SPINNER_MESSAGES.RETRYING).toBe('Yeniden deneniyor...');
    });
  });

  describe('lifecycle', () => {
    it('should handle full step lifecycle when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });

      // Start
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      expect(enabledService.getState()).toBe('spinning');
      expect(enabledService.isSpinning()).toBe(true);
      expect(enabledService.getCurrentStepId()).toBe(BmadStepType.BRAINSTORMING);

      // Succeed
      enabledService.succeedStep();
      expect(enabledService.getState()).toBe('succeeded');
      expect(enabledService.isSpinning()).toBe(false);
      expect(enabledService.getCurrentStepId()).toBeNull();
    });

    it('should handle failure lifecycle when enabled', () => {
      const enabledService = new SpinnerService({ enabled: true });

      // Start
      enabledService.startStep(BmadStepType.RESEARCH);
      expect(enabledService.getState()).toBe('spinning');

      // Fail
      enabledService.failStep('Test failure');
      expect(enabledService.getState()).toBe('failed');
      expect(enabledService.getCurrentStepId()).toBeNull();
    });

    it('should handle multiple steps sequentially', () => {
      const enabledService = new SpinnerService({ enabled: true });

      // First step
      enabledService.startStep(BmadStepType.BRAINSTORMING);
      enabledService.succeedStep();

      // Second step
      enabledService.startStep(BmadStepType.RESEARCH);
      expect(enabledService.getCurrentStepId()).toBe(BmadStepType.RESEARCH);
      enabledService.succeedStep();

      expect(enabledService.getState()).toBe('succeeded');
    });
  });

  describe('updateText', () => {
    it('should not update text when disabled', () => {
      spinnerService.start('Initial');
      spinnerService.updateText('Updated');
      // No error should occur
      expect(spinnerService.getState()).toBe('idle');
    });
  });
});
