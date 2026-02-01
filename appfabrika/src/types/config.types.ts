/**
 * AppFabrika Configuration Types
 * Defines the structure for user preferences and settings
 */

export const CONFIG_VERSION = '1.0.0';

export type LLMProvider = 'openai' | 'anthropic';

export type UIStyle = 'friendly' | 'minimal';

export type AutomationTemplate = 'full-auto' | 'business-manuel' | 'full-manuel' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
}

export interface UIConfig {
  style: UIStyle;
  language: string;
}

/**
 * Per-step automation mode preference
 */
export type StepAutomationMode = 'auto' | 'manual' | 'skip';

/**
 * Map of step IDs to their automation mode preferences
 */
export type StepAutomationPreferences = Partial<Record<string, StepAutomationMode>>;

export interface AutomationConfig {
  defaultTemplate: AutomationTemplate;
  /** Per-step automation preferences learned from user choices */
  stepPreferences?: StepAutomationPreferences;
}

export interface AppConfig {
  version: string;
  llm: LLMConfig;
  ui: UIConfig;
  automation: AutomationConfig;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CONFIG: Omit<AppConfig, 'createdAt' | 'updatedAt'> = {
  version: CONFIG_VERSION,
  llm: {
    provider: 'openai',
    model: 'gpt-4',
  },
  ui: {
    style: 'friendly',
    language: 'tr',
  },
  automation: {
    defaultTemplate: 'full-auto',
  },
};

/**
 * Creates a new config with default values and current timestamps
 * Note: Deep copies nested objects to prevent mutation issues
 */
export function createDefaultConfig(): AppConfig {
  const now = new Date().toISOString();
  return {
    version: DEFAULT_CONFIG.version,
    llm: { ...DEFAULT_CONFIG.llm },
    ui: { ...DEFAULT_CONFIG.ui },
    automation: { ...DEFAULT_CONFIG.automation },
    createdAt: now,
    updatedAt: now,
  };
}

// Valid values for union types
const VALID_LLM_PROVIDERS: LLMProvider[] = ['openai', 'anthropic'];
const VALID_UI_STYLES: UIStyle[] = ['friendly', 'minimal'];
const VALID_AUTOMATION_TEMPLATES: AutomationTemplate[] = ['full-auto', 'business-manuel', 'full-manuel', 'custom'];

/**
 * Type guard to check if an object is a valid AppConfig
 */
export function isValidConfig(obj: unknown): obj is AppConfig {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  // Basic structure checks
  if (
    typeof config.version !== 'string' ||
    typeof config.llm !== 'object' ||
    config.llm === null ||
    typeof config.ui !== 'object' ||
    config.ui === null ||
    typeof config.automation !== 'object' ||
    config.automation === null ||
    typeof config.createdAt !== 'string' ||
    typeof config.updatedAt !== 'string'
  ) {
    return false;
  }

  const llm = config.llm as Record<string, unknown>;
  const ui = config.ui as Record<string, unknown>;
  const automation = config.automation as Record<string, unknown>;

  // Type checks for nested objects
  if (
    typeof llm.provider !== 'string' ||
    typeof llm.model !== 'string' ||
    typeof ui.style !== 'string' ||
    typeof ui.language !== 'string' ||
    typeof automation.defaultTemplate !== 'string'
  ) {
    return false;
  }

  // Validate union type values
  if (!VALID_LLM_PROVIDERS.includes(llm.provider as LLMProvider)) {
    return false;
  }
  if (!VALID_UI_STYLES.includes(ui.style as UIStyle)) {
    return false;
  }
  if (!VALID_AUTOMATION_TEMPLATES.includes(automation.defaultTemplate as AutomationTemplate)) {
    return false;
  }

  return true;
}
