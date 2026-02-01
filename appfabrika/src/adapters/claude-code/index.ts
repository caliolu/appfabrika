/**
 * Claude Code Adapter Module
 * Exports Claude Code adapter for BMAD step execution
 */

export {
  ClaudeCodeAdapter,
  getClaudeCodeAdapter,
  resetClaudeCodeAdapter,
} from './claude-code.adapter.js';

// Re-export types for convenience
export type {
  ClaudeCodeExecutionOptions,
  ClaudeCodeResult,
  ClaudeCodeExecutionMetadata,
} from '../../types/claude-code.types.js';

export {
  CLAUDE_CODE_ERRORS,
  CLAUDE_CODE_DEFAULTS,
} from '../../types/claude-code.types.js';
