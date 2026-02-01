/**
 * Terminal UI Service
 * Handles terminal display for BMAD workflow steps
 */

import {
  BmadStepType,
  BMAD_STEP_NAMES,
  BMAD_STEP_EMOJIS,
  BMAD_STEP_DESCRIPTIONS,
  BMAD_STEPS,
} from '../../types/bmad.types.js';
import type { StepStatus } from '../../types/step.types.js';
import type { StepAutomationMode } from '../../types/config.types.js';

/**
 * Step display information for terminal rendering
 */
export interface StepDisplayInfo {
  /** Step identifier */
  stepId: BmadStepType;
  /** Emoji for the step */
  emoji: string;
  /** Turkish display name */
  name: string;
  /** Turkish description */
  description: string;
  /** Step number (1-12) */
  number: number;
}

/**
 * Options for rendering step display
 */
export interface RenderOptions {
  /** Show description below name */
  showDescription?: boolean;
  /** Indentation level (spaces) */
  indent?: number;
  /** Show step number prefix */
  showNumber?: boolean;
}

/**
 * Progress information for workflow display
 */
export interface ProgressInfo {
  /** Current step index (0-based) */
  currentIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Completed step count */
  completedCount: number;
  /** Skipped step count */
  skippedCount: number;
}

/**
 * Status display configuration
 */
export interface StatusDisplay {
  /** Status text in Turkish */
  text: string;
  /** ANSI color code */
  color: string;
}

/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m',
  WHITE: '\x1b[37m',
} as const;

/**
 * Status display mapping (Turkish)
 */
export const STATUS_DISPLAY: Record<StepStatus, StatusDisplay> = {
  pending: { text: 'Bekliyor', color: COLORS.GRAY },
  'in-progress': { text: 'Devam ediyor', color: COLORS.YELLOW },
  completed: { text: 'Tamamlandı', color: COLORS.GREEN },
  skipped: { text: 'Atlandı', color: COLORS.CYAN },
};

/**
 * Turkish messages for terminal UI
 */
export const UI_MESSAGES = {
  WORKFLOW_STARTED: 'BMAD workflow başlatılıyor...',
  WORKFLOW_COMPLETED: 'BMAD workflow tamamlandı!',
  WORKFLOW_FAILED: 'BMAD workflow başarısız oldu',
  STEP_STARTING: 'Adım başlatılıyor',
  STEP_COMPLETED: 'Adım tamamlandı',
  STEP_SKIPPED: 'Adım atlandı',
  PROGRESS: 'İlerleme',
  CURRENT_STEP: 'Mevcut adım',
  MANUAL_MODE: 'Manuel mod',
  AUTO_MODE: 'Otomatik mod',
  WORKFLOW_STATUS: 'BMAD Workflow Durumu',
  IN_PROGRESS_SUFFIX: '(devam ediyor)',
} as const;

/**
 * Status indicator icons for terminal display
 */
export const STATUS_ICONS: Record<StepStatus, string> = {
  pending: '-',
  'in-progress': '●',
  completed: '✓',
  skipped: '○',
};

/**
 * Automation mode display configuration
 */
export interface AutomationModeDisplay {
  /** Short indicator text */
  indicator: string;
  /** Full text in Turkish */
  text: string;
  /** ANSI color code */
  color: string;
}

/**
 * Automation mode indicators for terminal display
 */
export const AUTOMATION_MODE_INDICATORS: Record<StepAutomationMode, AutomationModeDisplay> = {
  auto: { indicator: '[A]', text: 'Otomatik', color: COLORS.GREEN },
  manual: { indicator: '[M]', text: 'Manuel', color: COLORS.YELLOW },
  skip: { indicator: '[S]', text: 'Atla', color: COLORS.CYAN },
};

/**
 * Step status with automation mode information
 */
export interface StepStatusWithMode {
  /** Step execution status */
  status: StepStatus;
  /** Automation mode for this step */
  automationMode?: StepAutomationMode;
}

/**
 * Completion statistics for workflow summary
 */
export interface CompletionStats {
  /** Number of completed steps */
  completedCount: number;
  /** Number of skipped steps */
  skippedCount: number;
  /** Number of failed steps */
  failedCount: number;
  /** Total steps in workflow */
  totalSteps: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Start time (ISO 8601) */
  startedAt: string;
  /** End time (ISO 8601) */
  completedAt: string;
}

/**
 * Next step recommendation
 */
export interface NextStep {
  /** Step number */
  number: number;
  /** Description in Turkish */
  description: string;
}

/**
 * Workflow summary for completion display
 */
export interface WorkflowSummary {
  /** Whether workflow completed successfully */
  success: boolean;
  /** Completion statistics */
  stats: CompletionStats;
  /** List of output files created */
  outputFiles: string[];
  /** Recommended next steps */
  nextSteps: NextStep[];
}

/**
 * Default next steps in Turkish
 */
export const DEFAULT_NEXT_STEPS: NextStep[] = [
  { number: 1, description: 'Üretilen belgeleri inceleyin' },
  { number: 2, description: 'Projeyi GitHub\'a yükleyin' },
  { number: 3, description: 'Geliştirmeye başlayın' },
];

/**
 * Summary section headers (Turkish)
 */
export const SUMMARY_HEADERS = {
  WORKFLOW_COMPLETED: 'BMAD Workflow Tamamlandı!',
  WORKFLOW_FAILED: 'BMAD Workflow Başarısız!',
  SUMMARY: 'Özet',
  OUTPUT_FILES: 'Çıktı dosyaları',
  NEXT_STEPS: 'Sonraki Adımlar',
  COMPLETED_STEPS: 'Tamamlanan adımlar',
  SKIPPED_STEPS: 'Atlanan adımlar',
  FAILED_STEPS: 'Başarısız adımlar',
  TOTAL_DURATION: 'Toplam süre',
} as const;

/**
 * Terminal UI Service for BMAD workflow display
 */
export class TerminalUI {
  private colorEnabled: boolean;

  constructor(options?: { colorEnabled?: boolean }) {
    this.colorEnabled = options?.colorEnabled ?? true;
  }

  /**
   * Get step display information
   */
  getStepDisplayInfo(stepId: BmadStepType): StepDisplayInfo {
    const stepIndex = BMAD_STEPS.indexOf(stepId);
    return {
      stepId,
      emoji: BMAD_STEP_EMOJIS[stepId],
      name: BMAD_STEP_NAMES[stepId],
      description: BMAD_STEP_DESCRIPTIONS[stepId],
      number: stepIndex + 1,
    };
  }

  /**
   * Format step display string with emoji and name
   * Example: "💡 Fikir Geliştirme"
   */
  formatStepDisplay(stepId: BmadStepType, options?: RenderOptions): string {
    const info = this.getStepDisplayInfo(stepId);
    const showNumber = options?.showNumber ?? false;
    const indent = options?.indent ?? 0;
    const showDescription = options?.showDescription ?? false;

    const indentStr = ' '.repeat(indent);
    const numberPrefix = showNumber ? `${info.number}. ` : '';
    const header = `${indentStr}${info.emoji} ${numberPrefix}${info.name}`;

    if (showDescription) {
      const descIndent = ' '.repeat(indent + 3);
      return `${header}\n${descIndent}${info.description}`;
    }

    return header;
  }

  /**
   * Render current step display with emoji and description
   * Output format:
   * 💡 Fikir Geliştirme
   *    Proje fikrini analiz ediyor...
   */
  renderCurrentStep(stepId: BmadStepType): string {
    return this.formatStepDisplay(stepId, { showDescription: true });
  }

  /**
   * Format step with status indicator
   * Example: "✅ Fikir Geliştirme - Tamamlandı"
   */
  formatStepWithStatus(stepId: BmadStepType, status: StepStatus): string {
    const info = this.getStepDisplayInfo(stepId);
    const statusInfo = STATUS_DISPLAY[status];

    const statusText = this.colorEnabled
      ? `${statusInfo.color}${statusInfo.text}${COLORS.RESET}`
      : statusInfo.text;

    return `${info.emoji} ${info.name} - ${statusText}`;
  }

  /**
   * Format progress indicator
   * Example: "İlerleme: 3/12 (25%)"
   */
  formatProgress(progress: ProgressInfo): string {
    const percentage = Math.round(
      (progress.completedCount / progress.totalSteps) * 100
    );
    return `${UI_MESSAGES.PROGRESS}: ${progress.completedCount}/${progress.totalSteps} (${percentage}%)`;
  }

  /**
   * Format step header with bold styling
   */
  formatStepHeader(stepId: BmadStepType): string {
    const info = this.getStepDisplayInfo(stepId);
    const header = `${info.emoji} ${info.name}`;

    return this.colorEnabled
      ? `${COLORS.BOLD}${header}${COLORS.RESET}`
      : header;
  }

  /**
   * Format step description with dim styling
   */
  formatStepDescription(stepId: BmadStepType, indent: number = 3): string {
    const info = this.getStepDisplayInfo(stepId);
    const indentStr = ' '.repeat(indent);
    const description = `${indentStr}${info.description}`;

    return this.colorEnabled
      ? `${COLORS.DIM}${description}${COLORS.RESET}`
      : description;
  }

  /**
   * Render full step display with colors
   */
  renderCurrentStepStyled(stepId: BmadStepType): string {
    const header = this.formatStepHeader(stepId);
    const description = this.formatStepDescription(stepId);
    return `${header}\n${description}`;
  }

  /**
   * Get all step display infos in order
   */
  getAllStepDisplayInfos(): StepDisplayInfo[] {
    return BMAD_STEPS.map((stepId) => this.getStepDisplayInfo(stepId));
  }

  /**
   * Enable or disable color output
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

  /**
   * Format a single step status line
   * Example: "[1] ✓ Fikir Geliştirme"
   */
  formatStepStatusLine(
    stepId: BmadStepType,
    status: StepStatus
  ): string {
    const info = this.getStepDisplayInfo(stepId);
    const icon = STATUS_ICONS[status];
    const statusInfo = STATUS_DISPLAY[status];

    // Format number with padding for alignment
    const numberStr = `[${info.number.toString().padStart(2, ' ')}]`;

    // Color the icon based on status
    const coloredIcon = this.colorEnabled
      ? `${statusInfo.color}${icon}${COLORS.RESET}`
      : icon;

    // Add suffix for in-progress
    const suffix = status === 'in-progress'
      ? ` ${UI_MESSAGES.IN_PROGRESS_SUFFIX}`
      : '';

    return `${numberStr} ${coloredIcon} ${info.name}${suffix}`;
  }

  /**
   * Format automation mode indicator
   * Example: "[A]" (colored)
   */
  formatAutomationModeIndicator(mode: StepAutomationMode): string {
    const modeInfo = AUTOMATION_MODE_INDICATORS[mode];
    return this.colorEnabled
      ? `${modeInfo.color}${modeInfo.indicator}${COLORS.RESET}`
      : modeInfo.indicator;
  }

  /**
   * Format a single step status line with automation mode
   * Example: "[ 1] ✓ [A] Fikir Geliştirme"
   */
  formatStepStatusLineWithMode(
    stepId: BmadStepType,
    status: StepStatus,
    automationMode?: StepAutomationMode
  ): string {
    const info = this.getStepDisplayInfo(stepId);
    const icon = STATUS_ICONS[status];
    const statusInfo = STATUS_DISPLAY[status];

    // Format number with padding for alignment
    const numberStr = `[${info.number.toString().padStart(2, ' ')}]`;

    // Color the icon based on status
    const coloredIcon = this.colorEnabled
      ? `${statusInfo.color}${icon}${COLORS.RESET}`
      : icon;

    // Format automation mode indicator
    const modeIndicator = automationMode
      ? ` ${this.formatAutomationModeIndicator(automationMode)}`
      : '';

    // Add suffix for in-progress
    const suffix = status === 'in-progress'
      ? ` ${UI_MESSAGES.IN_PROGRESS_SUFFIX}`
      : '';

    return `${numberStr} ${coloredIcon}${modeIndicator} ${info.name}${suffix}`;
  }

  /**
   * Calculate progress from step statuses
   */
  calculateProgress(
    stepStatuses: Map<BmadStepType, StepStatus>
  ): ProgressInfo {
    let completedCount = 0;
    let skippedCount = 0;
    let currentIndex = 0;

    BMAD_STEPS.forEach((stepId, index) => {
      const status = stepStatuses.get(stepId) ?? 'pending';
      if (status === 'completed') {
        completedCount++;
      } else if (status === 'skipped') {
        skippedCount++;
      } else if (status === 'in-progress') {
        currentIndex = index;
      }
    });

    return {
      currentIndex,
      totalSteps: BMAD_STEPS.length,
      completedCount,
      skippedCount,
    };
  }

  /**
   * Render the full step status overview
   * Shows all 12 steps with their status indicators
   */
  renderStepStatusOverview(
    stepStatuses: Map<BmadStepType, StepStatus>
  ): string {
    const lines: string[] = [];

    // Header
    const header = this.colorEnabled
      ? `${COLORS.BOLD}${UI_MESSAGES.WORKFLOW_STATUS}${COLORS.RESET}`
      : UI_MESSAGES.WORKFLOW_STATUS;
    lines.push(header);
    lines.push('='.repeat(UI_MESSAGES.WORKFLOW_STATUS.length));

    // Each step
    for (const stepId of BMAD_STEPS) {
      const status = stepStatuses.get(stepId) ?? 'pending';
      lines.push(this.formatStepStatusLine(stepId, status));
    }

    // Progress summary
    const progress = this.calculateProgress(stepStatuses);
    lines.push('');
    lines.push(this.formatProgress(progress));

    return lines.join('\n');
  }

  /**
   * Render a compact status overview (single line per step, no header)
   */
  renderCompactStatusOverview(
    stepStatuses: Map<BmadStepType, StepStatus>
  ): string {
    const lines: string[] = [];

    for (const stepId of BMAD_STEPS) {
      const status = stepStatuses.get(stepId) ?? 'pending';
      lines.push(this.formatStepStatusLine(stepId, status));
    }

    return lines.join('\n');
  }

  /**
   * Render the full step status overview with automation modes
   * Shows all 12 steps with their status and automation mode indicators
   */
  renderStepStatusOverviewWithModes(
    stepStatuses: Map<BmadStepType, StepStatus>,
    automationModes: Map<BmadStepType, StepAutomationMode>
  ): string {
    const lines: string[] = [];

    // Header
    const header = this.colorEnabled
      ? `${COLORS.BOLD}${UI_MESSAGES.WORKFLOW_STATUS}${COLORS.RESET}`
      : UI_MESSAGES.WORKFLOW_STATUS;
    lines.push(header);
    lines.push('='.repeat(UI_MESSAGES.WORKFLOW_STATUS.length));

    // Each step with automation mode
    for (const stepId of BMAD_STEPS) {
      const status = stepStatuses.get(stepId) ?? 'pending';
      const mode = automationModes.get(stepId);
      lines.push(this.formatStepStatusLineWithMode(stepId, status, mode));
    }

    // Progress summary
    const progress = this.calculateProgress(stepStatuses);
    lines.push('');
    lines.push(this.formatProgress(progress));

    // Automation mode summary
    const modeSummary = this.formatAutomationModeSummary(automationModes);
    if (modeSummary) {
      lines.push(modeSummary);
    }

    return lines.join('\n');
  }

  /**
   * Format automation mode summary line
   * Example: "Mod: 8 otomatik, 4 manuel"
   */
  formatAutomationModeSummary(
    automationModes: Map<BmadStepType, StepAutomationMode>
  ): string {
    let autoCount = 0;
    let manualCount = 0;
    let skipCount = 0;

    for (const mode of automationModes.values()) {
      if (mode === 'auto') autoCount++;
      else if (mode === 'manual') manualCount++;
      else if (mode === 'skip') skipCount++;
    }

    const parts: string[] = [];
    if (autoCount > 0) {
      parts.push(`${autoCount} otomatik`);
    }
    if (manualCount > 0) {
      parts.push(`${manualCount} manuel`);
    }
    if (skipCount > 0) {
      parts.push(`${skipCount} atla`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `Mod: ${parts.join(', ')}`;
  }

  /**
   * Render a compact status overview with automation modes
   */
  renderCompactStatusOverviewWithModes(
    stepStatuses: Map<BmadStepType, StepStatus>,
    automationModes: Map<BmadStepType, StepAutomationMode>
  ): string {
    const lines: string[] = [];

    for (const stepId of BMAD_STEPS) {
      const status = stepStatuses.get(stepId) ?? 'pending';
      const mode = automationModes.get(stepId);
      lines.push(this.formatStepStatusLineWithMode(stepId, status, mode));
    }

    return lines.join('\n');
  }

  /**
   * Render progress bar visualization
   * Example: "[████████░░░░] 67%"
   */
  renderProgressBar(progress: ProgressInfo, width: number = 12): string {
    const percentage = progress.completedCount / progress.totalSteps;
    const filled = Math.round(percentage * width);
    const empty = width - filled;

    const filledChar = this.colorEnabled
      ? `${COLORS.GREEN}█${COLORS.RESET}`
      : '█';
    const emptyChar = this.colorEnabled
      ? `${COLORS.GRAY}░${COLORS.RESET}`
      : '░';

    const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
    const percentText = `${Math.round(percentage * 100)}%`;

    return `[${bar}] ${percentText}`;
  }

  /**
   * Format duration in Turkish
   * Example: "5 dk 32 sn" or "1 sa 23 dk"
   */
  formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours} sa ${remainingMinutes} dk`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes} dk ${remainingSeconds} sn`;
    } else {
      return `${seconds} sn`;
    }
  }

  /**
   * Format completion statistics section
   */
  formatCompletionStats(stats: CompletionStats): string {
    const lines: string[] = [];
    const indent = '   ';

    lines.push(`${indent}• ${SUMMARY_HEADERS.COMPLETED_STEPS}: ${stats.completedCount}/${stats.totalSteps}`);

    if (stats.skippedCount > 0) {
      lines.push(`${indent}• ${SUMMARY_HEADERS.SKIPPED_STEPS}: ${stats.skippedCount}`);
    }

    if (stats.failedCount > 0) {
      lines.push(`${indent}• ${SUMMARY_HEADERS.FAILED_STEPS}: ${stats.failedCount}`);
    }

    lines.push(`${indent}• ${SUMMARY_HEADERS.TOTAL_DURATION}: ${this.formatDuration(stats.durationMs)}`);

    return lines.join('\n');
  }

  /**
   * Format output files section
   */
  formatOutputFiles(files: string[]): string {
    if (files.length === 0) {
      return '';
    }

    const lines: string[] = [];
    const indent = '   ';

    for (const file of files) {
      lines.push(`${indent}• ${file}`);
    }

    return lines.join('\n');
  }

  /**
   * Format next steps section
   */
  formatNextSteps(steps: NextStep[]): string {
    const lines: string[] = [];
    const indent = '   ';

    for (const step of steps) {
      lines.push(`${indent}${step.number}. ${step.description}`);
    }

    return lines.join('\n');
  }

  /**
   * Render completion summary
   * Shows full workflow completion with stats and next steps
   */
  renderCompletionSummary(summary: WorkflowSummary): string {
    const lines: string[] = [];

    // Header with emoji
    const headerText = summary.success
      ? SUMMARY_HEADERS.WORKFLOW_COMPLETED
      : SUMMARY_HEADERS.WORKFLOW_FAILED;
    const headerEmoji = summary.success ? '✨' : '❌';

    const header = this.colorEnabled
      ? `${COLORS.BOLD}${headerEmoji} ${headerText}${COLORS.RESET}`
      : `${headerEmoji} ${headerText}`;

    lines.push(header);
    lines.push('='.repeat(headerText.length + 2));
    lines.push('');

    // Statistics section
    const statsHeader = this.colorEnabled
      ? `${COLORS.BOLD}📊 ${SUMMARY_HEADERS.SUMMARY}:${COLORS.RESET}`
      : `📊 ${SUMMARY_HEADERS.SUMMARY}:`;
    lines.push(statsHeader);
    lines.push(this.formatCompletionStats(summary.stats));
    lines.push('');

    // Output files section (if any)
    if (summary.outputFiles.length > 0) {
      const filesHeader = this.colorEnabled
        ? `${COLORS.BOLD}📁 ${SUMMARY_HEADERS.OUTPUT_FILES}:${COLORS.RESET}`
        : `📁 ${SUMMARY_HEADERS.OUTPUT_FILES}:`;
      lines.push(filesHeader);
      lines.push(this.formatOutputFiles(summary.outputFiles));
      lines.push('');
    }

    // Next steps section
    if (summary.nextSteps.length > 0) {
      const nextHeader = this.colorEnabled
        ? `${COLORS.BOLD}🚀 ${SUMMARY_HEADERS.NEXT_STEPS}:${COLORS.RESET}`
        : `🚀 ${SUMMARY_HEADERS.NEXT_STEPS}:`;
      lines.push(nextHeader);
      lines.push(this.formatNextSteps(summary.nextSteps));
    }

    return lines.join('\n');
  }

  /**
   * Render a simple success completion message
   */
  renderSuccessCompletion(
    completedCount: number,
    totalSteps: number,
    durationMs: number
  ): string {
    const header = this.colorEnabled
      ? `${COLORS.BOLD}${COLORS.GREEN}✨ ${SUMMARY_HEADERS.WORKFLOW_COMPLETED}${COLORS.RESET}`
      : `✨ ${SUMMARY_HEADERS.WORKFLOW_COMPLETED}`;

    const stats = `${SUMMARY_HEADERS.COMPLETED_STEPS}: ${completedCount}/${totalSteps} | ${SUMMARY_HEADERS.TOTAL_DURATION}: ${this.formatDuration(durationMs)}`;

    return `${header}\n${stats}`;
  }

  /**
   * Render a simple failure completion message
   */
  renderFailureCompletion(
    completedCount: number,
    totalSteps: number,
    errorMessage?: string
  ): string {
    const header = this.colorEnabled
      ? `${COLORS.BOLD}${COLORS.YELLOW}❌ ${SUMMARY_HEADERS.WORKFLOW_FAILED}${COLORS.RESET}`
      : `❌ ${SUMMARY_HEADERS.WORKFLOW_FAILED}`;

    const stats = `${SUMMARY_HEADERS.COMPLETED_STEPS}: ${completedCount}/${totalSteps}`;
    const error = errorMessage ? `\nHata: ${errorMessage}` : '';

    return `${header}\n${stats}${error}`;
  }
}

// Singleton instance
let terminalUIInstance: TerminalUI | null = null;

/**
 * Get the singleton TerminalUI instance
 */
export function getTerminalUI(options?: { colorEnabled?: boolean }): TerminalUI {
  if (!terminalUIInstance) {
    terminalUIInstance = new TerminalUI(options);
  }
  return terminalUIInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTerminalUI(): void {
  terminalUIInstance = null;
}
