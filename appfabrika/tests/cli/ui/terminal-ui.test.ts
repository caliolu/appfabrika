/**
 * TerminalUI Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TerminalUI,
  getTerminalUI,
  resetTerminalUI,
  COLORS,
  STATUS_DISPLAY,
  STATUS_ICONS,
  AUTOMATION_MODE_INDICATORS,
  UI_MESSAGES,
  DEFAULT_NEXT_STEPS,
  SUMMARY_HEADERS,
  type CompletionStats,
  type WorkflowSummary,
} from '../../../src/cli/ui/terminal-ui.js';
import type { StepStatus } from '../../../src/types/step.types.js';
import type { StepAutomationMode } from '../../../src/types/config.types.js';
import { BmadStepType, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS, BMAD_STEP_DESCRIPTIONS } from '../../../src/types/bmad.types.js';

describe('TerminalUI', () => {
  let terminalUI: TerminalUI;

  beforeEach(() => {
    resetTerminalUI();
    terminalUI = new TerminalUI();
  });

  afterEach(() => {
    resetTerminalUI();
  });

  describe('getStepDisplayInfo', () => {
    it('should return correct display info for brainstorming step', () => {
      const info = terminalUI.getStepDisplayInfo(BmadStepType.BRAINSTORMING);

      expect(info.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(info.emoji).toBe('💡');
      expect(info.name).toBe('Fikir Geliştirme');
      expect(info.description).toBe('Proje fikrini analiz ediyor...');
      expect(info.number).toBe(1);
    });

    it('should return correct display info for QA testing step', () => {
      const info = terminalUI.getStepDisplayInfo(BmadStepType.QA_TESTING);

      expect(info.stepId).toBe(BmadStepType.QA_TESTING);
      expect(info.emoji).toBe('✅');
      expect(info.name).toBe('Test');
      expect(info.description).toBe('Test ve kalite kontrolü yapıyor...');
      expect(info.number).toBe(12);
    });

    it('should return correct number for each step', () => {
      expect(terminalUI.getStepDisplayInfo(BmadStepType.RESEARCH).number).toBe(2);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.PRODUCT_BRIEF).number).toBe(3);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.PRD).number).toBe(4);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.UX_DESIGN).number).toBe(5);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.ARCHITECTURE).number).toBe(6);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.EPICS_STORIES).number).toBe(7);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.SPRINT_PLANNING).number).toBe(8);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.TECH_SPEC).number).toBe(9);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.DEVELOPMENT).number).toBe(10);
      expect(terminalUI.getStepDisplayInfo(BmadStepType.CODE_REVIEW).number).toBe(11);
    });
  });

  describe('formatStepDisplay', () => {
    it('should format step with emoji and name', () => {
      const result = terminalUI.formatStepDisplay(BmadStepType.BRAINSTORMING);
      expect(result).toBe('💡 Fikir Geliştirme');
    });

    it('should format step with description when requested', () => {
      const result = terminalUI.formatStepDisplay(BmadStepType.BRAINSTORMING, {
        showDescription: true,
      });
      expect(result).toContain('💡 Fikir Geliştirme');
      expect(result).toContain('Proje fikrini analiz ediyor...');
    });

    it('should format step with number when requested', () => {
      const result = terminalUI.formatStepDisplay(BmadStepType.BRAINSTORMING, {
        showNumber: true,
      });
      expect(result).toBe('💡 1. Fikir Geliştirme');
    });

    it('should format step with indent', () => {
      const result = terminalUI.formatStepDisplay(BmadStepType.BRAINSTORMING, {
        indent: 4,
      });
      expect(result).toBe('    💡 Fikir Geliştirme');
    });

    it('should format step with all options', () => {
      const result = terminalUI.formatStepDisplay(BmadStepType.RESEARCH, {
        showDescription: true,
        showNumber: true,
        indent: 2,
      });
      expect(result).toContain('  🔍 2. Araştırma');
      expect(result).toContain('     Pazar ve teknik araştırma yapıyor...');
    });
  });

  describe('renderCurrentStep', () => {
    it('should render current step with emoji, name and description', () => {
      const result = terminalUI.renderCurrentStep(BmadStepType.BRAINSTORMING);

      expect(result).toContain('💡 Fikir Geliştirme');
      expect(result).toContain('Proje fikrini analiz ediyor...');
    });

    it('should render research step correctly', () => {
      const result = terminalUI.renderCurrentStep(BmadStepType.RESEARCH);

      expect(result).toContain('🔍 Araştırma');
      expect(result).toContain('Pazar ve teknik araştırma yapıyor...');
    });

    it('should render architecture step correctly', () => {
      const result = terminalUI.renderCurrentStep(BmadStepType.ARCHITECTURE);

      expect(result).toContain('🏗️ Mimari');
      expect(result).toContain('Teknik mimari planlıyor...');
    });
  });

  describe('formatStepWithStatus', () => {
    it('should format step with pending status', () => {
      const result = terminalUI.formatStepWithStatus(BmadStepType.BRAINSTORMING, 'pending');
      expect(result).toContain('💡 Fikir Geliştirme');
      expect(result).toContain('Bekliyor');
    });

    it('should format step with in-progress status', () => {
      const result = terminalUI.formatStepWithStatus(BmadStepType.RESEARCH, 'in-progress');
      expect(result).toContain('🔍 Araştırma');
      expect(result).toContain('Devam ediyor');
    });

    it('should format step with completed status', () => {
      const result = terminalUI.formatStepWithStatus(BmadStepType.PRD, 'completed');
      expect(result).toContain('📄 Gereksinimler');
      expect(result).toContain('Tamamlandı');
    });

    it('should format step with skipped status', () => {
      const result = terminalUI.formatStepWithStatus(BmadStepType.UX_DESIGN, 'skipped');
      expect(result).toContain('🎨 UX Tasarımı');
      expect(result).toContain('Atlandı');
    });
  });

  describe('formatProgress', () => {
    it('should format progress at start', () => {
      const result = terminalUI.formatProgress({
        currentIndex: 0,
        totalSteps: 12,
        completedCount: 0,
        skippedCount: 0,
      });
      expect(result).toBe('İlerleme: 0/12 (0%)');
    });

    it('should format progress at halfway', () => {
      const result = terminalUI.formatProgress({
        currentIndex: 6,
        totalSteps: 12,
        completedCount: 6,
        skippedCount: 0,
      });
      expect(result).toBe('İlerleme: 6/12 (50%)');
    });

    it('should format progress at completion', () => {
      const result = terminalUI.formatProgress({
        currentIndex: 11,
        totalSteps: 12,
        completedCount: 12,
        skippedCount: 0,
      });
      expect(result).toBe('İlerleme: 12/12 (100%)');
    });

    it('should round percentage correctly', () => {
      const result = terminalUI.formatProgress({
        currentIndex: 0,
        totalSteps: 12,
        completedCount: 1,
        skippedCount: 0,
      });
      expect(result).toBe('İlerleme: 1/12 (8%)');
    });
  });

  describe('formatStepHeader', () => {
    it('should format step header with bold when colors enabled', () => {
      const result = terminalUI.formatStepHeader(BmadStepType.BRAINSTORMING);
      expect(result).toContain('💡 Fikir Geliştirme');
      expect(result).toContain(COLORS.BOLD);
      expect(result).toContain(COLORS.RESET);
    });

    it('should format step header without colors when disabled', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepHeader(BmadStepType.BRAINSTORMING);
      expect(result).toBe('💡 Fikir Geliştirme');
      expect(result).not.toContain(COLORS.BOLD);
    });
  });

  describe('formatStepDescription', () => {
    it('should format step description with dim when colors enabled', () => {
      const result = terminalUI.formatStepDescription(BmadStepType.BRAINSTORMING);
      expect(result).toContain('Proje fikrini analiz ediyor...');
      expect(result).toContain(COLORS.DIM);
      expect(result).toContain(COLORS.RESET);
    });

    it('should apply default indent of 3 spaces', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepDescription(BmadStepType.BRAINSTORMING);
      expect(result).toBe('   Proje fikrini analiz ediyor...');
    });

    it('should apply custom indent', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepDescription(BmadStepType.BRAINSTORMING, 5);
      expect(result).toBe('     Proje fikrini analiz ediyor...');
    });
  });

  describe('renderCurrentStepStyled', () => {
    it('should render step with header and description', () => {
      const result = terminalUI.renderCurrentStepStyled(BmadStepType.BRAINSTORMING);
      expect(result).toContain('💡 Fikir Geliştirme');
      expect(result).toContain('Proje fikrini analiz ediyor...');
    });

    it('should include color codes when enabled', () => {
      const result = terminalUI.renderCurrentStepStyled(BmadStepType.BRAINSTORMING);
      expect(result).toContain(COLORS.BOLD);
      expect(result).toContain(COLORS.DIM);
    });
  });

  describe('getAllStepDisplayInfos', () => {
    it('should return all 12 step display infos', () => {
      const infos = terminalUI.getAllStepDisplayInfos();
      expect(infos).toHaveLength(12);
    });

    it('should return steps in correct order', () => {
      const infos = terminalUI.getAllStepDisplayInfos();
      expect(infos[0].stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(infos[11].stepId).toBe(BmadStepType.QA_TESTING);
    });

    it('should return correct numbers for all steps', () => {
      const infos = terminalUI.getAllStepDisplayInfos();
      infos.forEach((info, index) => {
        expect(info.number).toBe(index + 1);
      });
    });
  });

  describe('color management', () => {
    it('should have colors enabled by default', () => {
      expect(terminalUI.isColorEnabled()).toBe(true);
    });

    it('should disable colors', () => {
      terminalUI.setColorEnabled(false);
      expect(terminalUI.isColorEnabled()).toBe(false);
    });

    it('should enable colors', () => {
      terminalUI.setColorEnabled(false);
      terminalUI.setColorEnabled(true);
      expect(terminalUI.isColorEnabled()).toBe(true);
    });

    it('should initialize with colors disabled via options', () => {
      const ui = new TerminalUI({ colorEnabled: false });
      expect(ui.isColorEnabled()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const ui1 = getTerminalUI();
      const ui2 = getTerminalUI();
      expect(ui1).toBe(ui2);
    });

    it('should return new instance after reset', () => {
      const ui1 = getTerminalUI();
      resetTerminalUI();
      const ui2 = getTerminalUI();
      expect(ui1).not.toBe(ui2);
    });
  });

  describe('STATUS_DISPLAY constant', () => {
    it('should have all step statuses', () => {
      expect(STATUS_DISPLAY.pending.text).toBe('Bekliyor');
      expect(STATUS_DISPLAY['in-progress'].text).toBe('Devam ediyor');
      expect(STATUS_DISPLAY.completed.text).toBe('Tamamlandı');
      expect(STATUS_DISPLAY.skipped.text).toBe('Atlandı');
    });

    it('should have colors for all statuses', () => {
      expect(STATUS_DISPLAY.pending.color).toBe(COLORS.GRAY);
      expect(STATUS_DISPLAY['in-progress'].color).toBe(COLORS.YELLOW);
      expect(STATUS_DISPLAY.completed.color).toBe(COLORS.GREEN);
      expect(STATUS_DISPLAY.skipped.color).toBe(COLORS.CYAN);
    });
  });

  describe('UI_MESSAGES constant', () => {
    it('should have all required messages in Turkish', () => {
      expect(UI_MESSAGES.WORKFLOW_STARTED).toBe('BMAD workflow başlatılıyor...');
      expect(UI_MESSAGES.WORKFLOW_COMPLETED).toBe('BMAD workflow tamamlandı!');
      expect(UI_MESSAGES.WORKFLOW_FAILED).toBe('BMAD workflow başarısız oldu');
      expect(UI_MESSAGES.STEP_STARTING).toBe('Adım başlatılıyor');
      expect(UI_MESSAGES.STEP_COMPLETED).toBe('Adım tamamlandı');
      expect(UI_MESSAGES.STEP_SKIPPED).toBe('Adım atlandı');
      expect(UI_MESSAGES.PROGRESS).toBe('İlerleme');
      expect(UI_MESSAGES.CURRENT_STEP).toBe('Mevcut adım');
      expect(UI_MESSAGES.MANUAL_MODE).toBe('Manuel mod');
      expect(UI_MESSAGES.AUTO_MODE).toBe('Otomatik mod');
    });
  });

  describe('step emojis mapping', () => {
    it('should use correct emoji for each step type', () => {
      const ui = new TerminalUI();

      expect(ui.getStepDisplayInfo(BmadStepType.BRAINSTORMING).emoji).toBe('💡');
      expect(ui.getStepDisplayInfo(BmadStepType.RESEARCH).emoji).toBe('🔍');
      expect(ui.getStepDisplayInfo(BmadStepType.PRODUCT_BRIEF).emoji).toBe('📋');
      expect(ui.getStepDisplayInfo(BmadStepType.PRD).emoji).toBe('📄');
      expect(ui.getStepDisplayInfo(BmadStepType.UX_DESIGN).emoji).toBe('🎨');
      expect(ui.getStepDisplayInfo(BmadStepType.ARCHITECTURE).emoji).toBe('🏗️');
      expect(ui.getStepDisplayInfo(BmadStepType.EPICS_STORIES).emoji).toBe('📝');
      expect(ui.getStepDisplayInfo(BmadStepType.SPRINT_PLANNING).emoji).toBe('📅');
      expect(ui.getStepDisplayInfo(BmadStepType.TECH_SPEC).emoji).toBe('🔧');
      expect(ui.getStepDisplayInfo(BmadStepType.DEVELOPMENT).emoji).toBe('💻');
      expect(ui.getStepDisplayInfo(BmadStepType.CODE_REVIEW).emoji).toBe('🔎');
      expect(ui.getStepDisplayInfo(BmadStepType.QA_TESTING).emoji).toBe('✅');
    });
  });

  describe('Turkish text content', () => {
    it('should display all step names in Turkish', () => {
      const ui = new TerminalUI();
      const infos = ui.getAllStepDisplayInfos();

      expect(infos[0].name).toBe('Fikir Geliştirme');
      expect(infos[1].name).toBe('Araştırma');
      expect(infos[2].name).toBe('Ürün Özeti');
      expect(infos[3].name).toBe('Gereksinimler');
      expect(infos[4].name).toBe('UX Tasarımı');
      expect(infos[5].name).toBe('Mimari');
      expect(infos[6].name).toBe('Epic ve Hikayeler');
      expect(infos[7].name).toBe('Sprint Planlama');
      expect(infos[8].name).toBe('Teknik Şartname');
      expect(infos[9].name).toBe('Geliştirme');
      expect(infos[10].name).toBe('Kod İnceleme');
      expect(infos[11].name).toBe('Test');
    });

    it('should display all step descriptions in Turkish', () => {
      const ui = new TerminalUI();
      const infos = ui.getAllStepDisplayInfos();

      expect(infos[0].description).toBe('Proje fikrini analiz ediyor...');
      expect(infos[1].description).toBe('Pazar ve teknik araştırma yapıyor...');
      expect(infos[2].description).toBe('Ürün özeti oluşturuyor...');
      expect(infos[3].description).toBe('Gereksinim dokümanı hazırlıyor...');
      expect(infos[4].description).toBe('Kullanıcı deneyimi tasarlıyor...');
      expect(infos[5].description).toBe('Teknik mimari planlıyor...');
      expect(infos[6].description).toBe('Epic ve hikayeler oluşturuyor...');
      expect(infos[7].description).toBe('Sprint planı hazırlıyor...');
      expect(infos[8].description).toBe('Teknik şartname yazıyor...');
      expect(infos[9].description).toBe('Kod geliştiriyor...');
      expect(infos[10].description).toBe('Kod incelemesi yapıyor...');
      expect(infos[11].description).toBe('Test ve kalite kontrolü yapıyor...');
    });
  });

  describe('STATUS_ICONS constant', () => {
    it('should have icons for all statuses', () => {
      expect(STATUS_ICONS.pending).toBe('-');
      expect(STATUS_ICONS['in-progress']).toBe('●');
      expect(STATUS_ICONS.completed).toBe('✓');
      expect(STATUS_ICONS.skipped).toBe('○');
    });
  });

  describe('formatStepStatusLine', () => {
    it('should format pending step', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLine(BmadStepType.BRAINSTORMING, 'pending');
      expect(result).toBe('[ 1] - Fikir Geliştirme');
    });

    it('should format completed step', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLine(BmadStepType.BRAINSTORMING, 'completed');
      expect(result).toBe('[ 1] ✓ Fikir Geliştirme');
    });

    it('should format in-progress step with suffix', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLine(BmadStepType.RESEARCH, 'in-progress');
      expect(result).toBe('[ 2] ● Araştırma (devam ediyor)');
    });

    it('should format skipped step', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLine(BmadStepType.UX_DESIGN, 'skipped');
      expect(result).toBe('[ 5] ○ UX Tasarımı');
    });

    it('should pad step number for double digits', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLine(BmadStepType.QA_TESTING, 'pending');
      expect(result).toBe('[12] - Test');
    });

    it('should include color codes when colors enabled', () => {
      const result = terminalUI.formatStepStatusLine(BmadStepType.BRAINSTORMING, 'completed');
      expect(result).toContain(COLORS.GREEN);
      expect(result).toContain(COLORS.RESET);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress for empty workflow', () => {
      const stepStatuses = new Map<BmadStepType, StepStatus>();
      const progress = terminalUI.calculateProgress(stepStatuses);

      expect(progress.completedCount).toBe(0);
      expect(progress.skippedCount).toBe(0);
      expect(progress.totalSteps).toBe(12);
    });

    it('should calculate progress with completed steps', () => {
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'completed'],
        [BmadStepType.PRODUCT_BRIEF, 'in-progress'],
      ]);
      const progress = terminalUI.calculateProgress(stepStatuses);

      expect(progress.completedCount).toBe(2);
      expect(progress.currentIndex).toBe(2);
      expect(progress.totalSteps).toBe(12);
    });

    it('should count skipped steps', () => {
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'skipped'],
        [BmadStepType.PRODUCT_BRIEF, 'completed'],
      ]);
      const progress = terminalUI.calculateProgress(stepStatuses);

      expect(progress.completedCount).toBe(2);
      expect(progress.skippedCount).toBe(1);
    });

    it('should track current index for in-progress step', () => {
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'completed'],
        [BmadStepType.PRODUCT_BRIEF, 'completed'],
        [BmadStepType.PRD, 'completed'],
        [BmadStepType.UX_DESIGN, 'in-progress'],
      ]);
      const progress = terminalUI.calculateProgress(stepStatuses);

      expect(progress.currentIndex).toBe(4);
    });
  });

  describe('renderStepStatusOverview', () => {
    it('should render header', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>();
      const result = terminalUI.renderStepStatusOverview(stepStatuses);

      expect(result).toContain('BMAD Workflow Durumu');
      expect(result).toContain('='.repeat('BMAD Workflow Durumu'.length));
    });

    it('should render all 12 steps', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>();
      const result = terminalUI.renderStepStatusOverview(stepStatuses);

      expect(result).toContain('Fikir Geliştirme');
      expect(result).toContain('Araştırma');
      expect(result).toContain('Ürün Özeti');
      expect(result).toContain('Gereksinimler');
      expect(result).toContain('UX Tasarımı');
      expect(result).toContain('Mimari');
      expect(result).toContain('Epic ve Hikayeler');
      expect(result).toContain('Sprint Planlama');
      expect(result).toContain('Teknik Şartname');
      expect(result).toContain('Geliştirme');
      expect(result).toContain('Kod İnceleme');
      expect(result).toContain('Test');
    });

    it('should show progress at bottom', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'completed'],
      ]);
      const result = terminalUI.renderStepStatusOverview(stepStatuses);

      expect(result).toContain('İlerleme: 2/12');
    });

    it('should show correct status icons', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'in-progress'],
      ]);
      const result = terminalUI.renderStepStatusOverview(stepStatuses);

      expect(result).toContain('✓ Fikir Geliştirme');
      expect(result).toContain('● Araştırma (devam ediyor)');
      expect(result).toContain('- Ürün Özeti');
    });
  });

  describe('renderCompactStatusOverview', () => {
    it('should not include header', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>();
      const result = terminalUI.renderCompactStatusOverview(stepStatuses);

      expect(result).not.toContain('BMAD Workflow Durumu');
      expect(result).not.toContain('=');
    });

    it('should render all 12 steps', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>();
      const result = terminalUI.renderCompactStatusOverview(stepStatuses);
      const lines = result.split('\n');

      expect(lines).toHaveLength(12);
    });

    it('should show statuses correctly', () => {
      terminalUI.setColorEnabled(false);
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'skipped'],
      ]);
      const result = terminalUI.renderCompactStatusOverview(stepStatuses);

      expect(result).toContain('✓ Fikir Geliştirme');
      expect(result).toContain('○ Araştırma');
    });
  });

  describe('renderProgressBar', () => {
    it('should render empty progress bar', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderProgressBar({
        currentIndex: 0,
        totalSteps: 12,
        completedCount: 0,
        skippedCount: 0,
      });

      expect(result).toBe('[░░░░░░░░░░░░] 0%');
    });

    it('should render half progress bar', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderProgressBar({
        currentIndex: 5,
        totalSteps: 12,
        completedCount: 6,
        skippedCount: 0,
      });

      expect(result).toBe('[██████░░░░░░] 50%');
    });

    it('should render full progress bar', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderProgressBar({
        currentIndex: 11,
        totalSteps: 12,
        completedCount: 12,
        skippedCount: 0,
      });

      expect(result).toBe('[████████████] 100%');
    });

    it('should support custom width', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderProgressBar({
        currentIndex: 5,
        totalSteps: 12,
        completedCount: 6,
        skippedCount: 0,
      }, 6);

      expect(result).toBe('[███░░░] 50%');
    });

    it('should include colors when enabled', () => {
      const result = terminalUI.renderProgressBar({
        currentIndex: 5,
        totalSteps: 12,
        completedCount: 6,
        skippedCount: 0,
      });

      expect(result).toContain(COLORS.GREEN);
      expect(result).toContain(COLORS.GRAY);
    });
  });

  describe('AUTOMATION_MODE_INDICATORS constant', () => {
    it('should have indicators for all modes', () => {
      expect(AUTOMATION_MODE_INDICATORS.auto.indicator).toBe('[A]');
      expect(AUTOMATION_MODE_INDICATORS.manual.indicator).toBe('[M]');
      expect(AUTOMATION_MODE_INDICATORS.skip.indicator).toBe('[S]');
    });

    it('should have Turkish text for all modes', () => {
      expect(AUTOMATION_MODE_INDICATORS.auto.text).toBe('Otomatik');
      expect(AUTOMATION_MODE_INDICATORS.manual.text).toBe('Manuel');
      expect(AUTOMATION_MODE_INDICATORS.skip.text).toBe('Atla');
    });

    it('should have colors for all modes', () => {
      expect(AUTOMATION_MODE_INDICATORS.auto.color).toBe(COLORS.GREEN);
      expect(AUTOMATION_MODE_INDICATORS.manual.color).toBe(COLORS.YELLOW);
      expect(AUTOMATION_MODE_INDICATORS.skip.color).toBe(COLORS.CYAN);
    });
  });

  describe('formatAutomationModeIndicator', () => {
    it('should format auto mode indicator', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatAutomationModeIndicator('auto');
      expect(result).toBe('[A]');
    });

    it('should format manual mode indicator', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatAutomationModeIndicator('manual');
      expect(result).toBe('[M]');
    });

    it('should format skip mode indicator', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatAutomationModeIndicator('skip');
      expect(result).toBe('[S]');
    });

    it('should include colors when enabled', () => {
      const result = terminalUI.formatAutomationModeIndicator('auto');
      expect(result).toContain(COLORS.GREEN);
      expect(result).toContain(COLORS.RESET);
    });

    it('should use yellow for manual mode', () => {
      const result = terminalUI.formatAutomationModeIndicator('manual');
      expect(result).toContain(COLORS.YELLOW);
    });
  });

  describe('formatStepStatusLineWithMode', () => {
    it('should format step with auto mode', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLineWithMode(
        BmadStepType.BRAINSTORMING,
        'completed',
        'auto'
      );
      expect(result).toBe('[ 1] ✓ [A] Fikir Geliştirme');
    });

    it('should format step with manual mode', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLineWithMode(
        BmadStepType.RESEARCH,
        'in-progress',
        'manual'
      );
      expect(result).toBe('[ 2] ● [M] Araştırma (devam ediyor)');
    });

    it('should format step with skip mode', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLineWithMode(
        BmadStepType.UX_DESIGN,
        'skipped',
        'skip'
      );
      expect(result).toBe('[ 5] ○ [S] UX Tasarımı');
    });

    it('should format step without mode when not provided', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.formatStepStatusLineWithMode(
        BmadStepType.BRAINSTORMING,
        'pending',
        undefined
      );
      expect(result).toBe('[ 1] - Fikir Geliştirme');
    });

    it('should include colors when enabled', () => {
      const result = terminalUI.formatStepStatusLineWithMode(
        BmadStepType.BRAINSTORMING,
        'completed',
        'auto'
      );
      expect(result).toContain(COLORS.GREEN); // For completed status
      expect(result).toContain(COLORS.GREEN); // For auto mode
    });
  });

  describe('formatAutomationModeSummary', () => {
    it('should format summary with only auto modes', () => {
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'auto'],
        [BmadStepType.RESEARCH, 'auto'],
        [BmadStepType.PRODUCT_BRIEF, 'auto'],
      ]);
      const result = terminalUI.formatAutomationModeSummary(modes);
      expect(result).toBe('Mod: 3 otomatik');
    });

    it('should format summary with mixed modes', () => {
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'auto'],
        [BmadStepType.RESEARCH, 'auto'],
        [BmadStepType.PRODUCT_BRIEF, 'manual'],
        [BmadStepType.PRD, 'manual'],
        [BmadStepType.UX_DESIGN, 'skip'],
      ]);
      const result = terminalUI.formatAutomationModeSummary(modes);
      expect(result).toBe('Mod: 2 otomatik, 2 manuel, 1 atla');
    });

    it('should return empty string for empty modes', () => {
      const modes = new Map<BmadStepType, StepAutomationMode>();
      const result = terminalUI.formatAutomationModeSummary(modes);
      expect(result).toBe('');
    });

    it('should format summary with only manual modes', () => {
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'manual'],
        [BmadStepType.RESEARCH, 'manual'],
      ]);
      const result = terminalUI.formatAutomationModeSummary(modes);
      expect(result).toBe('Mod: 2 manuel');
    });
  });

  describe('renderStepStatusOverviewWithModes', () => {
    it('should render header', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>();
      const modes = new Map<BmadStepType, StepAutomationMode>();
      const result = terminalUI.renderStepStatusOverviewWithModes(statuses, modes);

      expect(result).toContain('BMAD Workflow Durumu');
    });

    it('should render all steps with modes', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'in-progress'],
      ]);
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'auto'],
        [BmadStepType.RESEARCH, 'manual'],
      ]);
      const result = terminalUI.renderStepStatusOverviewWithModes(statuses, modes);

      expect(result).toContain('✓ [A] Fikir Geliştirme');
      expect(result).toContain('● [M] Araştırma (devam ediyor)');
    });

    it('should show progress summary', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
        [BmadStepType.RESEARCH, 'completed'],
      ]);
      const modes = new Map<BmadStepType, StepAutomationMode>();
      const result = terminalUI.renderStepStatusOverviewWithModes(statuses, modes);

      expect(result).toContain('İlerleme: 2/12');
    });

    it('should show mode summary', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>();
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'auto'],
        [BmadStepType.RESEARCH, 'manual'],
      ]);
      const result = terminalUI.renderStepStatusOverviewWithModes(statuses, modes);

      expect(result).toContain('Mod: 1 otomatik, 1 manuel');
    });
  });

  describe('renderCompactStatusOverviewWithModes', () => {
    it('should not include header', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>();
      const modes = new Map<BmadStepType, StepAutomationMode>();
      const result = terminalUI.renderCompactStatusOverviewWithModes(statuses, modes);

      expect(result).not.toContain('BMAD Workflow Durumu');
    });

    it('should render all 12 steps', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>();
      const modes = new Map<BmadStepType, StepAutomationMode>();
      const result = terminalUI.renderCompactStatusOverviewWithModes(statuses, modes);
      const lines = result.split('\n');

      expect(lines).toHaveLength(12);
    });

    it('should show modes correctly', () => {
      terminalUI.setColorEnabled(false);
      const statuses = new Map<BmadStepType, StepStatus>([
        [BmadStepType.BRAINSTORMING, 'completed'],
      ]);
      const modes = new Map<BmadStepType, StepAutomationMode>([
        [BmadStepType.BRAINSTORMING, 'auto'],
        [BmadStepType.RESEARCH, 'manual'],
      ]);
      const result = terminalUI.renderCompactStatusOverviewWithModes(statuses, modes);

      expect(result).toContain('✓ [A] Fikir Geliştirme');
      expect(result).toContain('- [M] Araştırma');
    });
  });

  describe('DEFAULT_NEXT_STEPS constant', () => {
    it('should have 3 default next steps in Turkish', () => {
      expect(DEFAULT_NEXT_STEPS).toHaveLength(3);
      expect(DEFAULT_NEXT_STEPS[0].number).toBe(1);
      expect(DEFAULT_NEXT_STEPS[0].description).toBe('Üretilen belgeleri inceleyin');
      expect(DEFAULT_NEXT_STEPS[1].number).toBe(2);
      expect(DEFAULT_NEXT_STEPS[1].description).toContain('GitHub');
      expect(DEFAULT_NEXT_STEPS[2].number).toBe(3);
      expect(DEFAULT_NEXT_STEPS[2].description).toBe('Geliştirmeye başlayın');
    });
  });

  describe('SUMMARY_HEADERS constant', () => {
    it('should have all required Turkish headers', () => {
      expect(SUMMARY_HEADERS.WORKFLOW_COMPLETED).toBe('BMAD Workflow Tamamlandı!');
      expect(SUMMARY_HEADERS.WORKFLOW_FAILED).toBe('BMAD Workflow Başarısız!');
      expect(SUMMARY_HEADERS.SUMMARY).toBe('Özet');
      expect(SUMMARY_HEADERS.OUTPUT_FILES).toBe('Çıktı dosyaları');
      expect(SUMMARY_HEADERS.NEXT_STEPS).toBe('Sonraki Adımlar');
      expect(SUMMARY_HEADERS.COMPLETED_STEPS).toBe('Tamamlanan adımlar');
      expect(SUMMARY_HEADERS.SKIPPED_STEPS).toBe('Atlanan adımlar');
      expect(SUMMARY_HEADERS.FAILED_STEPS).toBe('Başarısız adımlar');
      expect(SUMMARY_HEADERS.TOTAL_DURATION).toBe('Toplam süre');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      const result = terminalUI.formatDuration(45000);
      expect(result).toBe('45 sn');
    });

    it('should format minutes and seconds', () => {
      const result = terminalUI.formatDuration(332000);
      expect(result).toBe('5 dk 32 sn');
    });

    it('should format hours and minutes', () => {
      const result = terminalUI.formatDuration(4980000);
      expect(result).toBe('1 sa 23 dk');
    });

    it('should format zero duration', () => {
      const result = terminalUI.formatDuration(0);
      expect(result).toBe('0 sn');
    });

    it('should format exactly one minute', () => {
      const result = terminalUI.formatDuration(60000);
      expect(result).toBe('1 dk 0 sn');
    });

    it('should format exactly one hour', () => {
      const result = terminalUI.formatDuration(3600000);
      expect(result).toBe('1 sa 0 dk');
    });
  });

  describe('formatCompletionStats', () => {
    it('should format basic stats', () => {
      terminalUI.setColorEnabled(false);
      const stats: CompletionStats = {
        completedCount: 10,
        skippedCount: 0,
        failedCount: 0,
        totalSteps: 12,
        durationMs: 332000,
        startedAt: '2026-01-31T10:00:00Z',
        completedAt: '2026-01-31T10:05:32Z',
      };
      const result = terminalUI.formatCompletionStats(stats);

      expect(result).toContain('Tamamlanan adımlar: 10/12');
      expect(result).toContain('Toplam süre: 5 dk 32 sn');
      expect(result).not.toContain('Atlanan adımlar');
      expect(result).not.toContain('Başarısız adımlar');
    });

    it('should include skipped count when present', () => {
      terminalUI.setColorEnabled(false);
      const stats: CompletionStats = {
        completedCount: 10,
        skippedCount: 2,
        failedCount: 0,
        totalSteps: 12,
        durationMs: 300000,
        startedAt: '2026-01-31T10:00:00Z',
        completedAt: '2026-01-31T10:05:00Z',
      };
      const result = terminalUI.formatCompletionStats(stats);

      expect(result).toContain('Atlanan adımlar: 2');
    });

    it('should include failed count when present', () => {
      terminalUI.setColorEnabled(false);
      const stats: CompletionStats = {
        completedCount: 9,
        skippedCount: 0,
        failedCount: 1,
        totalSteps: 12,
        durationMs: 300000,
        startedAt: '2026-01-31T10:00:00Z',
        completedAt: '2026-01-31T10:05:00Z',
      };
      const result = terminalUI.formatCompletionStats(stats);

      expect(result).toContain('Başarısız adımlar: 1');
    });
  });

  describe('formatOutputFiles', () => {
    it('should return empty string for no files', () => {
      const result = terminalUI.formatOutputFiles([]);
      expect(result).toBe('');
    });

    it('should format single file', () => {
      const result = terminalUI.formatOutputFiles(['.appfabrika/outputs/step-01.md']);
      expect(result).toContain('.appfabrika/outputs/step-01.md');
    });

    it('should format multiple files', () => {
      const result = terminalUI.formatOutputFiles([
        '.appfabrika/outputs/step-01.md',
        '.appfabrika/outputs/step-02.md',
      ]);
      expect(result).toContain('step-01.md');
      expect(result).toContain('step-02.md');
    });
  });

  describe('formatNextSteps', () => {
    it('should format next steps with numbers', () => {
      const result = terminalUI.formatNextSteps(DEFAULT_NEXT_STEPS);

      expect(result).toContain('1. Üretilen belgeleri inceleyin');
      expect(result).toContain('2.');
      expect(result).toContain('3. Geliştirmeye başlayın');
    });

    it('should format custom next steps', () => {
      const steps = [
        { number: 1, description: 'Test adımı' },
        { number: 2, description: 'İkinci adım' },
      ];
      const result = terminalUI.formatNextSteps(steps);

      expect(result).toContain('1. Test adımı');
      expect(result).toContain('2. İkinci adım');
    });
  });

  describe('renderCompletionSummary', () => {
    it('should render success summary', () => {
      terminalUI.setColorEnabled(false);
      const summary: WorkflowSummary = {
        success: true,
        stats: {
          completedCount: 12,
          skippedCount: 0,
          failedCount: 0,
          totalSteps: 12,
          durationMs: 600000,
          startedAt: '2026-01-31T10:00:00Z',
          completedAt: '2026-01-31T10:10:00Z',
        },
        outputFiles: ['.appfabrika/outputs/step-01.md'],
        nextSteps: DEFAULT_NEXT_STEPS,
      };
      const result = terminalUI.renderCompletionSummary(summary);

      expect(result).toContain('✨ BMAD Workflow Tamamlandı!');
      expect(result).toContain('📊 Özet:');
      expect(result).toContain('Tamamlanan adımlar: 12/12');
      expect(result).toContain('📁 Çıktı dosyaları:');
      expect(result).toContain('🚀 Sonraki Adımlar:');
    });

    it('should render failure summary', () => {
      terminalUI.setColorEnabled(false);
      const summary: WorkflowSummary = {
        success: false,
        stats: {
          completedCount: 5,
          skippedCount: 0,
          failedCount: 1,
          totalSteps: 12,
          durationMs: 300000,
          startedAt: '2026-01-31T10:00:00Z',
          completedAt: '2026-01-31T10:05:00Z',
        },
        outputFiles: [],
        nextSteps: [],
      };
      const result = terminalUI.renderCompletionSummary(summary);

      expect(result).toContain('❌ BMAD Workflow Başarısız!');
      expect(result).toContain('Başarısız adımlar: 1');
    });

    it('should not include output files section when empty', () => {
      terminalUI.setColorEnabled(false);
      const summary: WorkflowSummary = {
        success: true,
        stats: {
          completedCount: 12,
          skippedCount: 0,
          failedCount: 0,
          totalSteps: 12,
          durationMs: 600000,
          startedAt: '2026-01-31T10:00:00Z',
          completedAt: '2026-01-31T10:10:00Z',
        },
        outputFiles: [],
        nextSteps: DEFAULT_NEXT_STEPS,
      };
      const result = terminalUI.renderCompletionSummary(summary);

      expect(result).not.toContain('📁 Çıktı dosyaları:');
    });
  });

  describe('renderSuccessCompletion', () => {
    it('should render simple success message', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderSuccessCompletion(12, 12, 600000);

      expect(result).toContain('✨ BMAD Workflow Tamamlandı!');
      expect(result).toContain('Tamamlanan adımlar: 12/12');
      expect(result).toContain('Toplam süre: 10 dk 0 sn');
    });
  });

  describe('renderFailureCompletion', () => {
    it('should render simple failure message', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderFailureCompletion(5, 12);

      expect(result).toContain('❌ BMAD Workflow Başarısız!');
      expect(result).toContain('Tamamlanan adımlar: 5/12');
    });

    it('should include error message when provided', () => {
      terminalUI.setColorEnabled(false);
      const result = terminalUI.renderFailureCompletion(5, 12, 'API bağlantı hatası');

      expect(result).toContain('Hata: API bağlantı hatası');
    });
  });
});
