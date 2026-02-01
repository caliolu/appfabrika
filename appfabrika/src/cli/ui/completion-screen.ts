/**
 * Completion Screen
 * Displays final completion summary with next steps
 * Implements Story 8.3 - Completion Screen
 */

import { COLORS } from './terminal-ui.js';

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  /** Total number of steps */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Number of skipped steps */
  skippedSteps: number;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Completion information
 */
export interface CompletionInfo {
  /** Project name */
  projectName: string;
  /** GitHub repository URL */
  repoUrl?: string;
  /** Local project path */
  localPath: string;
  /** Workflow statistics */
  stats: WorkflowStats;
  /** List of output files created */
  outputFiles?: string[];
}

/**
 * Next step command
 */
export interface NextStepCommand {
  /** Command to run */
  command: string;
  /** Description of what the command does */
  description?: string;
}

/**
 * Configuration for completion screen
 */
export interface CompletionScreenConfig {
  /** Enable colors */
  colorEnabled?: boolean;
  /** Show statistics */
  showStats?: boolean;
  /** Show next steps */
  showNextSteps?: boolean;
  /** Custom next steps */
  nextSteps?: NextStepCommand[];
}

/**
 * Turkish messages for completion screen
 */
export const COMPLETION_MESSAGES = {
  CONGRATULATIONS: 'Tebrikler! Projeniz hazır!',
  GITHUB_LABEL: 'GitHub',
  LOCAL_LABEL: 'Yerel',
  STATS_LABEL: 'İstatistikler',
  STEPS_COMPLETED: '{completed} adım tamamlandı',
  STEPS_SKIPPED: '{skipped} adım atlandı',
  TOTAL_DURATION: 'Toplam süre: {duration}',
  NEXT_STEPS_LABEL: 'Sonraki Adımlar',
  HAPPY_CODING: 'İyi kodlamalar!',
  PROJECT_CREATED: 'Proje oluşturuldu',
  NO_GITHUB: 'GitHub\'a yüklenmedi',
} as const;

/**
 * Default next steps for a new project
 */
export const DEFAULT_NEXT_STEP_COMMANDS: NextStepCommand[] = [
  { command: 'cd {projectPath}', description: 'Proje dizinine git' },
  { command: 'npm install', description: 'Bağımlılıkları yükle' },
  { command: 'npm run dev', description: 'Geliştirme sunucusunu başlat' },
];

/**
 * Completion Screen Service
 */
export class CompletionScreen {
  private colorEnabled: boolean;

  /**
   * Create a new CompletionScreen
   * @param config - Screen configuration
   */
  constructor(config?: CompletionScreenConfig) {
    this.colorEnabled = config?.colorEnabled ?? true;
  }

  /**
   * Format duration from milliseconds to human-readable string
   * @param ms - Duration in milliseconds
   * @returns Formatted duration string
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours} saat ${remainingMinutes} dakika`;
    }

    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes} dakika ${remainingSeconds} saniye`;
    }

    return `${seconds} saniye`;
  }

  /**
   * Format the header with celebration emoji
   */
  formatHeader(): string {
    const emoji = '🎉';
    const text = COMPLETION_MESSAGES.CONGRATULATIONS;

    if (this.colorEnabled) {
      return `${emoji} ${COLORS.BOLD}${COLORS.GREEN}${text}${COLORS.RESET}`;
    }
    return `${emoji} ${text}`;
  }

  /**
   * Format the GitHub URL line
   * @param repoUrl - GitHub repository URL
   */
  formatGitHubLine(repoUrl?: string): string {
    const label = COMPLETION_MESSAGES.GITHUB_LABEL;
    const indent = '   ';

    if (!repoUrl) {
      const value = this.colorEnabled
        ? `${COLORS.DIM}${COMPLETION_MESSAGES.NO_GITHUB}${COLORS.RESET}`
        : COMPLETION_MESSAGES.NO_GITHUB;
      return `${indent}${label}: ${value}`;
    }

    const value = this.colorEnabled
      ? `${COLORS.CYAN}${repoUrl}${COLORS.RESET}`
      : repoUrl;
    return `${indent}${label}: ${value}`;
  }

  /**
   * Format the local path line
   * @param localPath - Local project path
   */
  formatLocalLine(localPath: string): string {
    const label = COMPLETION_MESSAGES.LOCAL_LABEL;
    const indent = '   ';

    const value = this.colorEnabled
      ? `${COLORS.CYAN}${localPath}${COLORS.RESET}`
      : localPath;
    return `${indent}${label}:  ${value}`;
  }

  /**
   * Format the statistics section
   * @param stats - Workflow statistics
   */
  formatStats(stats: WorkflowStats): string {
    const lines: string[] = [];
    const indent = '   ';

    // Section header
    const header = this.colorEnabled
      ? `${indent}${COLORS.BOLD}${COMPLETION_MESSAGES.STATS_LABEL}:${COLORS.RESET}`
      : `${indent}${COMPLETION_MESSAGES.STATS_LABEL}:`;
    lines.push(header);

    // Steps completed
    const completedText = COMPLETION_MESSAGES.STEPS_COMPLETED
      .replace('{completed}', String(stats.completedSteps));
    lines.push(`${indent}• ${completedText}`);

    // Steps skipped (only if > 0)
    if (stats.skippedSteps > 0) {
      const skippedText = COMPLETION_MESSAGES.STEPS_SKIPPED
        .replace('{skipped}', String(stats.skippedSteps));
      lines.push(`${indent}• ${skippedText}`);
    }

    // Duration
    const durationFormatted = this.formatDuration(stats.durationMs);
    const durationText = COMPLETION_MESSAGES.TOTAL_DURATION
      .replace('{duration}', durationFormatted);
    lines.push(`${indent}• ${durationText}`);

    return lines.join('\n');
  }

  /**
   * Format the next steps section
   * @param nextSteps - List of next step commands
   * @param projectPath - Project path for command substitution
   */
  formatNextSteps(nextSteps: NextStepCommand[], projectPath: string): string {
    const lines: string[] = [];
    const indent = '   ';

    // Section header
    const header = this.colorEnabled
      ? `${indent}${COLORS.BOLD}${COMPLETION_MESSAGES.NEXT_STEPS_LABEL}:${COLORS.RESET}`
      : `${indent}${COMPLETION_MESSAGES.NEXT_STEPS_LABEL}:`;
    lines.push(header);

    // Commands
    for (const step of nextSteps) {
      const command = step.command.replace('{projectPath}', projectPath);
      const formattedCommand = this.colorEnabled
        ? `${COLORS.GREEN}$ ${command}${COLORS.RESET}`
        : `$ ${command}`;
      lines.push(`${indent}${formattedCommand}`);
    }

    return lines.join('\n');
  }

  /**
   * Format the footer with happy coding message
   */
  formatFooter(): string {
    const emoji = '🚀';
    const text = COMPLETION_MESSAGES.HAPPY_CODING;
    const indent = '   ';

    if (this.colorEnabled) {
      return `${indent}${COLORS.BOLD}${text}${COLORS.RESET} ${emoji}`;
    }
    return `${indent}${text} ${emoji}`;
  }

  /**
   * Render the full completion screen
   * @param info - Completion information
   * @param config - Optional configuration
   */
  render(info: CompletionInfo, config?: CompletionScreenConfig): string {
    const showStats = config?.showStats ?? true;
    const showNextSteps = config?.showNextSteps ?? true;
    const nextSteps = config?.nextSteps ?? DEFAULT_NEXT_STEP_COMMANDS;

    const lines: string[] = [];

    // Header
    lines.push(this.formatHeader());
    lines.push('');

    // URLs section
    lines.push(this.formatGitHubLine(info.repoUrl));
    lines.push(this.formatLocalLine(info.localPath));
    lines.push('');

    // Statistics section
    if (showStats) {
      lines.push(this.formatStats(info.stats));
      lines.push('');
    }

    // Next steps section
    if (showNextSteps) {
      lines.push(this.formatNextSteps(nextSteps, info.localPath));
      lines.push('');
    }

    // Footer
    lines.push(this.formatFooter());

    return lines.join('\n');
  }

  /**
   * Render a simple completion message
   * @param projectName - Project name
   * @param localPath - Local project path
   */
  renderSimple(projectName: string, localPath: string): string {
    const emoji = '✅';
    const text = this.colorEnabled
      ? `${emoji} ${COLORS.GREEN}${COMPLETION_MESSAGES.PROJECT_CREATED}: ${projectName}${COLORS.RESET}`
      : `${emoji} ${COMPLETION_MESSAGES.PROJECT_CREATED}: ${projectName}`;

    return `${text}\n   ${localPath}`;
  }

  /**
   * Enable or disable colors
   * @param enabled - Whether colors are enabled
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

/**
 * Singleton instance
 */
let instance: CompletionScreen | null = null;

/**
 * Get or create the singleton CompletionScreen instance
 * @param config - Optional configuration
 * @returns The CompletionScreen instance
 */
export function getCompletionScreen(config?: CompletionScreenConfig): CompletionScreen {
  if (!instance) {
    instance = new CompletionScreen(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCompletionScreen(): void {
  instance = null;
}
