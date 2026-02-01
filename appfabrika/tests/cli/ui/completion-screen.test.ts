/**
 * CompletionScreen Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CompletionScreen,
  getCompletionScreen,
  resetCompletionScreen,
  COMPLETION_MESSAGES,
  DEFAULT_NEXT_STEP_COMMANDS,
  type CompletionInfo,
  type WorkflowStats,
} from '../../../src/cli/ui/completion-screen.js';
import { COLORS } from '../../../src/cli/ui/terminal-ui.js';

describe('CompletionScreen', () => {
  let completionScreen: CompletionScreen;
  let sampleStats: WorkflowStats;
  let sampleInfo: CompletionInfo;

  beforeEach(() => {
    resetCompletionScreen();
    completionScreen = new CompletionScreen({ colorEnabled: false });

    sampleStats = {
      totalSteps: 12,
      completedSteps: 10,
      skippedSteps: 2,
      durationMs: 2700000, // 45 minutes
    };

    sampleInfo = {
      projectName: 'my-project',
      repoUrl: 'https://github.com/user/my-project',
      localPath: '/home/user/projects/my-project',
      stats: sampleStats,
    };
  });

  afterEach(() => {
    resetCompletionScreen();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const screen = new CompletionScreen();
      expect(screen.isColorEnabled()).toBe(true);
    });

    it('should create with colors disabled', () => {
      const screen = new CompletionScreen({ colorEnabled: false });
      expect(screen.isColorEnabled()).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      const result = completionScreen.formatDuration(30000);
      expect(result).toBe('30 saniye');
    });

    it('should format minutes and seconds', () => {
      const result = completionScreen.formatDuration(150000); // 2min 30sec
      expect(result).toBe('2 dakika 30 saniye');
    });

    it('should format hours and minutes', () => {
      const result = completionScreen.formatDuration(5400000); // 1hr 30min
      expect(result).toBe('1 saat 30 dakika');
    });

    it('should handle zero duration', () => {
      const result = completionScreen.formatDuration(0);
      expect(result).toBe('0 saniye');
    });
  });

  describe('formatHeader', () => {
    it('should format header without colors', () => {
      const result = completionScreen.formatHeader();
      expect(result).toBe('🎉 Tebrikler! Projeniz hazır!');
    });

    it('should format header with colors', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatHeader();
      expect(result).toContain(COLORS.GREEN);
      expect(result).toContain(COLORS.BOLD);
      expect(result).toContain('Tebrikler');
    });
  });

  describe('formatGitHubLine', () => {
    it('should format GitHub URL', () => {
      const result = completionScreen.formatGitHubLine('https://github.com/user/project');
      expect(result).toContain('GitHub');
      expect(result).toContain('https://github.com/user/project');
    });

    it('should show no GitHub message when no URL', () => {
      const result = completionScreen.formatGitHubLine(undefined);
      expect(result).toContain('GitHub');
      expect(result).toContain(COMPLETION_MESSAGES.NO_GITHUB);
    });

    it('should use colors when enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatGitHubLine('https://github.com/user/project');
      expect(result).toContain(COLORS.CYAN);
    });
  });

  describe('formatLocalLine', () => {
    it('should format local path', () => {
      const result = completionScreen.formatLocalLine('/home/user/project');
      expect(result).toContain('Yerel');
      expect(result).toContain('/home/user/project');
    });

    it('should use colors when enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatLocalLine('/home/user/project');
      expect(result).toContain(COLORS.CYAN);
    });
  });

  describe('formatStats', () => {
    it('should format statistics', () => {
      const result = completionScreen.formatStats(sampleStats);
      expect(result).toContain('İstatistikler');
      expect(result).toContain('10 adım tamamlandı');
      expect(result).toContain('2 adım atlandı');
      expect(result).toContain('45 dakika');
    });

    it('should not show skipped if zero', () => {
      const stats: WorkflowStats = {
        totalSteps: 12,
        completedSteps: 12,
        skippedSteps: 0,
        durationMs: 1800000,
      };
      const result = completionScreen.formatStats(stats);
      expect(result).not.toContain('atlandı');
    });

    it('should use bold for header when colors enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatStats(sampleStats);
      expect(result).toContain(COLORS.BOLD);
    });
  });

  describe('formatNextSteps', () => {
    it('should format next steps', () => {
      const result = completionScreen.formatNextSteps(
        DEFAULT_NEXT_STEP_COMMANDS,
        '/home/user/project'
      );
      expect(result).toContain('Sonraki Adımlar');
      expect(result).toContain('cd /home/user/project');
      expect(result).toContain('npm install');
      expect(result).toContain('npm run dev');
    });

    it('should replace {projectPath} placeholder', () => {
      const steps = [{ command: 'cd {projectPath}' }];
      const result = completionScreen.formatNextSteps(steps, '/my/path');
      expect(result).toContain('cd /my/path');
      expect(result).not.toContain('{projectPath}');
    });

    it('should use green color for commands when enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatNextSteps(
        DEFAULT_NEXT_STEP_COMMANDS,
        '/path'
      );
      expect(result).toContain(COLORS.GREEN);
    });
  });

  describe('formatFooter', () => {
    it('should format footer', () => {
      const result = completionScreen.formatFooter();
      expect(result).toContain('İyi kodlamalar');
      expect(result).toContain('🚀');
    });

    it('should use bold when colors enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.formatFooter();
      expect(result).toContain(COLORS.BOLD);
    });
  });

  describe('render', () => {
    it('should render full completion screen', () => {
      const result = completionScreen.render(sampleInfo);

      expect(result).toContain('🎉');
      expect(result).toContain('Tebrikler');
      expect(result).toContain('https://github.com/user/my-project');
      expect(result).toContain('/home/user/projects/my-project');
      expect(result).toContain('İstatistikler');
      expect(result).toContain('10 adım tamamlandı');
      expect(result).toContain('Sonraki Adımlar');
      expect(result).toContain('İyi kodlamalar');
      expect(result).toContain('🚀');
    });

    it('should hide stats when showStats is false', () => {
      const result = completionScreen.render(sampleInfo, { showStats: false });
      expect(result).not.toContain('İstatistikler');
      expect(result).not.toContain('adım tamamlandı');
    });

    it('should hide next steps when showNextSteps is false', () => {
      const result = completionScreen.render(sampleInfo, { showNextSteps: false });
      expect(result).not.toContain('Sonraki Adımlar');
      expect(result).not.toContain('npm install');
    });

    it('should use custom next steps', () => {
      const customSteps = [
        { command: 'custom command 1' },
        { command: 'custom command 2' },
      ];
      const result = completionScreen.render(sampleInfo, { nextSteps: customSteps });
      expect(result).toContain('custom command 1');
      expect(result).toContain('custom command 2');
      expect(result).not.toContain('npm install');
    });
  });

  describe('renderSimple', () => {
    it('should render simple completion message', () => {
      const result = completionScreen.renderSimple('my-project', '/path/to/project');
      expect(result).toContain('✅');
      expect(result).toContain('Proje oluşturuldu');
      expect(result).toContain('my-project');
      expect(result).toContain('/path/to/project');
    });

    it('should use colors when enabled', () => {
      const colorScreen = new CompletionScreen({ colorEnabled: true });
      const result = colorScreen.renderSimple('my-project', '/path');
      expect(result).toContain(COLORS.GREEN);
    });
  });

  describe('color management', () => {
    it('should enable colors', () => {
      completionScreen.setColorEnabled(true);
      expect(completionScreen.isColorEnabled()).toBe(true);
    });

    it('should disable colors', () => {
      const screen = new CompletionScreen({ colorEnabled: true });
      screen.setColorEnabled(false);
      expect(screen.isColorEnabled()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const screen1 = getCompletionScreen();
      const screen2 = getCompletionScreen();
      expect(screen1).toBe(screen2);
    });

    it('should return new instance after reset', () => {
      const screen1 = getCompletionScreen();
      resetCompletionScreen();
      const screen2 = getCompletionScreen();
      expect(screen1).not.toBe(screen2);
    });
  });
});

describe('COMPLETION_MESSAGES constant', () => {
  it('should have Turkish messages', () => {
    expect(COMPLETION_MESSAGES.CONGRATULATIONS).toContain('Tebrikler');
    expect(COMPLETION_MESSAGES.GITHUB_LABEL).toBe('GitHub');
    expect(COMPLETION_MESSAGES.LOCAL_LABEL).toBe('Yerel');
    expect(COMPLETION_MESSAGES.STATS_LABEL).toBe('İstatistikler');
    expect(COMPLETION_MESSAGES.STEPS_COMPLETED).toContain('tamamlandı');
    expect(COMPLETION_MESSAGES.STEPS_SKIPPED).toContain('atlandı');
    expect(COMPLETION_MESSAGES.TOTAL_DURATION).toContain('süre');
    expect(COMPLETION_MESSAGES.NEXT_STEPS_LABEL).toContain('Sonraki');
    expect(COMPLETION_MESSAGES.HAPPY_CODING).toContain('kodlamalar');
    expect(COMPLETION_MESSAGES.PROJECT_CREATED).toContain('oluşturuldu');
    expect(COMPLETION_MESSAGES.NO_GITHUB).toContain('yüklenmedi');
  });
});

describe('DEFAULT_NEXT_STEP_COMMANDS constant', () => {
  it('should have default commands', () => {
    expect(DEFAULT_NEXT_STEP_COMMANDS).toHaveLength(3);
    expect(DEFAULT_NEXT_STEP_COMMANDS[0].command).toContain('cd');
    expect(DEFAULT_NEXT_STEP_COMMANDS[1].command).toBe('npm install');
    expect(DEFAULT_NEXT_STEP_COMMANDS[2].command).toBe('npm run dev');
  });

  it('should have Turkish descriptions', () => {
    expect(DEFAULT_NEXT_STEP_COMMANDS[0].description).toContain('dizinine');
    expect(DEFAULT_NEXT_STEP_COMMANDS[1].description).toContain('yükle');
    expect(DEFAULT_NEXT_STEP_COMMANDS[2].description).toContain('başlat');
  });
});
