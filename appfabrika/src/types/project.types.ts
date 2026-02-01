/**
 * Project Types
 * Defines types for project state during initialization
 */

/**
 * Supported LLM providers
 * Used for API selection during project initialization
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * Automation templates for BMAD workflow control
 * Determines how much manual input is required during workflow execution
 */
export type AutomationTemplate = 'full-auto' | 'checkpoint';

/**
 * Project configuration stored in .appfabrika/config.json
 */
export interface ProjectConfig {
  /** Config file version */
  version: '1.0.0';
  /** Derived project name (folder name) */
  projectName: string;
  /** User's project idea */
  idea: string;
  /** Selected LLM provider */
  llmProvider: LLMProvider;
  /** Selected automation template */
  automationTemplate: AutomationTemplate;
  /** Project creation timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Project state during init flow
 * Populated step by step as user provides input
 */
export interface ProjectState {
  /** User's project idea in one sentence */
  idea: string;
  /** Selected LLM provider for BMAD workflow */
  llmProvider?: LLMProvider;
  /** Selected automation template for workflow control */
  automationTemplate?: AutomationTemplate;
  /** Path to created project folder */
  projectPath?: string;
}
