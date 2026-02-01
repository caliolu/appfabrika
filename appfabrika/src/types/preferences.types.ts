/**
 * Preferences Types
 * Defines types for user default preferences
 */

import type { LLMProvider, AutomationTemplate } from './config.types.js';

// Re-export from config.types for convenience
export type { LLMProvider, AutomationTemplate } from './config.types.js';

/**
 * User's default preferences for new projects
 */
export interface DefaultPreferences {
  llm: {
    provider: LLMProvider;
    model: string;
  };
  automation: {
    template: AutomationTemplate;
  };
}
