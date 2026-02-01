/**
 * PreferencesManager - Manages user default preferences
 * Thin wrapper around ConfigManager for preference-specific operations
 */

import { getConfigManager } from './config.js';
import type { LLMProvider, AutomationTemplate, StepAutomationMode, StepAutomationPreferences } from '../types/config.types.js';
import type { DefaultPreferences } from '../types/preferences.types.js';
import type { BmadStepType } from '../types/bmad.types.js';

// Valid values for validation
const VALID_PROVIDERS: readonly LLMProvider[] = ['openai', 'anthropic'] as const;
const VALID_TEMPLATES: readonly AutomationTemplate[] = ['full-auto', 'business-manuel', 'full-manuel', 'custom'] as const;

/**
 * Validates and normalizes provider to a valid LLMProvider
 * @returns The trimmed, validated provider
 * @throws Error if provider is invalid
 */
function validateAndNormalizeProvider(provider: string): LLMProvider {
  if (!provider || typeof provider !== 'string') {
    throw new Error('LLM provider cannot be empty');
  }
  const trimmed = provider.trim() as LLMProvider;
  if (!VALID_PROVIDERS.includes(trimmed)) {
    throw new Error(`Invalid LLM provider: "${provider}". Valid options: ${VALID_PROVIDERS.join(', ')}`);
  }
  return trimmed;
}

/**
 * Validates and normalizes template to a valid AutomationTemplate
 * @returns The trimmed, validated template
 * @throws Error if template is invalid
 */
function validateAndNormalizeTemplate(template: string): AutomationTemplate {
  if (!template || typeof template !== 'string') {
    throw new Error('Automation template cannot be empty');
  }
  const trimmed = template.trim() as AutomationTemplate;
  if (!VALID_TEMPLATES.includes(trimmed)) {
    throw new Error(`Invalid automation template: "${template}". Valid options: ${VALID_TEMPLATES.join(', ')}`);
  }
  return trimmed;
}

/**
 * Validates that model is a non-empty string
 * @throws Error if model is invalid
 */
function validateModel(model: string): void {
  if (!model || typeof model !== 'string') {
    throw new Error('LLM model cannot be empty');
  }
  if (!model.trim()) {
    throw new Error('LLM model cannot be empty');
  }
}

export class PreferencesManager {
  constructor() {
    // Lazy initialization - ConfigManager handles all storage
  }

  /**
   * Sets the default LLM provider
   * @param provider - 'openai' or 'anthropic'
   * @throws Error if provider is invalid
   */
  async setDefaultLLMProvider(provider: LLMProvider): Promise<void> {
    const normalizedProvider = validateAndNormalizeProvider(provider);
    const configManager = getConfigManager();
    await configManager.update({ llm: { provider: normalizedProvider } });
  }

  /**
   * Sets the default LLM model
   * @param model - Model name (e.g., 'gpt-4', 'claude-3-opus')
   * @throws Error if model is empty
   */
  async setDefaultLLMModel(model: string): Promise<void> {
    validateModel(model);
    const configManager = getConfigManager();
    await configManager.update({ llm: { model: model.trim() } });
  }

  /**
   * Sets the default automation template
   * @param template - One of: 'full-auto', 'business-manuel', 'full-manuel', 'custom'
   * @throws Error if template is invalid
   */
  async setDefaultAutomationTemplate(template: AutomationTemplate): Promise<void> {
    const normalizedTemplate = validateAndNormalizeTemplate(template);
    const configManager = getConfigManager();
    await configManager.update({ automation: { defaultTemplate: normalizedTemplate } });
  }

  /**
   * Gets the default LLM provider
   */
  async getDefaultLLMProvider(): Promise<LLMProvider> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return config.llm.provider;
  }

  /**
   * Gets the default LLM model
   */
  async getDefaultLLMModel(): Promise<string> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return config.llm.model;
  }

  /**
   * Gets the default automation template
   */
  async getDefaultAutomationTemplate(): Promise<AutomationTemplate> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return config.automation.defaultTemplate;
  }

  /**
   * Gets all default preferences
   */
  async getAllDefaults(): Promise<DefaultPreferences> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return {
      llm: {
        provider: config.llm.provider,
        model: config.llm.model,
      },
      automation: {
        template: config.automation.defaultTemplate,
      },
    };
  }

  // ============================================
  // Step Automation Preferences
  // ============================================

  /**
   * Sets automation preference for a specific step
   * @param stepId - The BMAD step ID
   * @param mode - The automation mode preference
   */
  async setStepAutomationPreference(
    stepId: BmadStepType,
    mode: StepAutomationMode
  ): Promise<void> {
    const configManager = getConfigManager();
    const config = await configManager.get();

    const currentPrefs = config.automation.stepPreferences ?? {};
    const updatedPrefs = { ...currentPrefs, [stepId]: mode };

    await configManager.update({
      automation: {
        ...config.automation,
        stepPreferences: updatedPrefs,
      },
    });
  }

  /**
   * Gets automation preference for a specific step
   * @param stepId - The BMAD step ID
   * @returns The automation mode or undefined if not set
   */
  async getStepAutomationPreference(
    stepId: BmadStepType
  ): Promise<StepAutomationMode | undefined> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return config.automation.stepPreferences?.[stepId];
  }

  /**
   * Gets all step automation preferences
   */
  async getAllStepAutomationPreferences(): Promise<StepAutomationPreferences> {
    const configManager = getConfigManager();
    const config = await configManager.get();
    return config.automation.stepPreferences ?? {};
  }

  /**
   * Sets all step automation preferences at once
   * @param preferences - Map of step IDs to automation modes
   */
  async setAllStepAutomationPreferences(
    preferences: StepAutomationPreferences
  ): Promise<void> {
    const configManager = getConfigManager();
    const config = await configManager.get();

    await configManager.update({
      automation: {
        ...config.automation,
        stepPreferences: preferences,
      },
    });
  }

  /**
   * Clears all step automation preferences
   */
  async clearStepAutomationPreferences(): Promise<void> {
    const configManager = getConfigManager();
    const config = await configManager.get();

    await configManager.update({
      automation: {
        ...config.automation,
        stepPreferences: {},
      },
    });
  }

  /**
   * Saves current workflow state as preferences
   * Call this after workflow completion to remember user's choices
   * @param stepModes - Map of step IDs to the modes used
   */
  async saveWorkflowPreferences(
    stepModes: Map<BmadStepType, StepAutomationMode>
  ): Promise<void> {
    const preferences: StepAutomationPreferences = {};
    for (const [stepId, mode] of stepModes) {
      preferences[stepId] = mode;
    }
    await this.setAllStepAutomationPreferences(preferences);
  }
}

// Singleton instance
let instance: PreferencesManager | null = null;

/**
 * Gets the singleton PreferencesManager instance
 */
export function getPreferencesManager(): PreferencesManager {
  if (!instance) {
    instance = new PreferencesManager();
  }
  return instance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetPreferencesManager(): void {
  instance = null;
}

// Re-export types for convenience
export type { DefaultPreferences } from '../types/preferences.types.js';
export type { LLMProvider, AutomationTemplate } from '../types/config.types.js';
