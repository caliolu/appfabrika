/**
 * CLI UI Module Exports
 */

export {
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
  type StepDisplayInfo,
  type RenderOptions,
  type ProgressInfo,
  type StatusDisplay,
  type AutomationModeDisplay,
  type StepStatusWithMode,
  type CompletionStats,
  type NextStep,
  type WorkflowSummary,
} from './terminal-ui.js';

export {
  SpinnerService,
  getSpinnerService,
  resetSpinnerService,
  SPINNER_MESSAGES,
  type SpinnerState,
  type SpinnerOptions,
} from './spinner-service.js';

export {
  ErrorDisplay,
  getErrorDisplay,
  resetErrorDisplay,
  ErrorAction,
  ERROR_MESSAGES,
  ERROR_LABELS,
  DEFAULT_ACTIONS,
  EXTENDED_ACTIONS,
  type ErrorDisplayConfig,
  type ErrorInfo,
  type ActionOption,
} from './error-display.js';

export {
  CompletionScreen,
  getCompletionScreen,
  resetCompletionScreen,
  COMPLETION_MESSAGES,
  DEFAULT_NEXT_STEP_COMMANDS,
  type CompletionScreenConfig,
  type CompletionInfo,
  type WorkflowStats,
  type NextStepCommand,
} from './completion-screen.js';
