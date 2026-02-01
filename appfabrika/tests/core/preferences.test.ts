/**
 * PreferencesManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPreferencesManager,
  resetPreferencesManager,
} from '../../src/core/preferences.js';
import { resetConfigManager } from '../../src/core/config.js';

describe('PreferencesManager', () => {
  beforeEach(() => {
    resetPreferencesManager();
    resetConfigManager();
  });

  afterEach(() => {
    resetPreferencesManager();
    resetConfigManager();
  });

  describe('setDefaultLLMProvider', () => {
    it('should set openai as default provider', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultLLMProvider('openai');

      const provider = await prefsManager.getDefaultLLMProvider();
      expect(provider).toBe('openai');
    });

    it('should set anthropic as default provider', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultLLMProvider('anthropic');

      const provider = await prefsManager.getDefaultLLMProvider();
      expect(provider).toBe('anthropic');
    });

    it('should throw error for invalid provider', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMProvider('invalid' as any)
      ).rejects.toThrow('Invalid LLM provider: "invalid". Valid options: openai, anthropic');
    });

    it('should throw error for empty provider', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMProvider('' as any)
      ).rejects.toThrow('LLM provider cannot be empty');
    });

    it('should throw error for null provider', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMProvider(null as any)
      ).rejects.toThrow('LLM provider cannot be empty');
    });
  });

  describe('setDefaultLLMModel', () => {
    it('should set gpt-4 as default model', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultLLMModel('gpt-4');

      const model = await prefsManager.getDefaultLLMModel();
      expect(model).toBe('gpt-4');
    });

    it('should set claude-3-opus as default model', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultLLMModel('claude-3-opus');

      const model = await prefsManager.getDefaultLLMModel();
      expect(model).toBe('claude-3-opus');
    });

    it('should trim whitespace from model', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultLLMModel('  gpt-4-turbo  ');

      const model = await prefsManager.getDefaultLLMModel();
      expect(model).toBe('gpt-4-turbo');
    });

    it('should throw error for empty model', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMModel('')
      ).rejects.toThrow('LLM model cannot be empty');
    });

    it('should throw error for whitespace-only model', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMModel('   ')
      ).rejects.toThrow('LLM model cannot be empty');
    });

    it('should throw error for null model', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultLLMModel(null as any)
      ).rejects.toThrow('LLM model cannot be empty');
    });
  });

  describe('setDefaultAutomationTemplate', () => {
    it('should set full-auto as default template', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultAutomationTemplate('full-auto');

      const template = await prefsManager.getDefaultAutomationTemplate();
      expect(template).toBe('full-auto');
    });

    it('should set business-manuel as default template', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultAutomationTemplate('business-manuel');

      const template = await prefsManager.getDefaultAutomationTemplate();
      expect(template).toBe('business-manuel');
    });

    it('should set full-manuel as default template', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultAutomationTemplate('full-manuel');

      const template = await prefsManager.getDefaultAutomationTemplate();
      expect(template).toBe('full-manuel');
    });

    it('should set custom as default template', async () => {
      const prefsManager = getPreferencesManager();
      await prefsManager.setDefaultAutomationTemplate('custom');

      const template = await prefsManager.getDefaultAutomationTemplate();
      expect(template).toBe('custom');
    });

    it('should throw error for invalid template', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultAutomationTemplate('invalid' as any)
      ).rejects.toThrow('Invalid automation template: "invalid". Valid options: full-auto, business-manuel, full-manuel, custom');
    });

    it('should throw error for empty template', async () => {
      const prefsManager = getPreferencesManager();

      await expect(
        prefsManager.setDefaultAutomationTemplate('' as any)
      ).rejects.toThrow('Automation template cannot be empty');
    });
  });

  describe('getAllDefaults', () => {
    it('should return all default preferences', async () => {
      const prefsManager = getPreferencesManager();

      // Set some preferences
      await prefsManager.setDefaultLLMProvider('anthropic');
      await prefsManager.setDefaultLLMModel('claude-3-sonnet');
      await prefsManager.setDefaultAutomationTemplate('business-manuel');

      const defaults = await prefsManager.getAllDefaults();

      expect(defaults).toEqual({
        llm: {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
        },
        automation: {
          template: 'business-manuel',
        },
      });
    });

    it('should return current config values', async () => {
      const prefsManager = getPreferencesManager();

      // First set to known values to test retrieval
      await prefsManager.setDefaultLLMProvider('openai');
      await prefsManager.setDefaultLLMModel('gpt-4');
      await prefsManager.setDefaultAutomationTemplate('full-auto');

      const defaults = await prefsManager.getAllDefaults();

      // Should return the values we just set
      expect(defaults.llm.provider).toBe('openai');
      expect(defaults.llm.model).toBe('gpt-4');
      expect(defaults.automation.template).toBe('full-auto');
    });
  });

  describe('persistence across instances', () => {
    it('should persist preferences across PreferencesManager instances', async () => {
      // First instance - set preferences
      const prefs1 = getPreferencesManager();
      await prefs1.setDefaultLLMProvider('anthropic');
      await prefs1.setDefaultLLMModel('claude-3-opus');
      await prefs1.setDefaultAutomationTemplate('custom');

      // Reset singleton to simulate new session
      resetPreferencesManager();

      // Second instance - should read persisted values
      const prefs2 = getPreferencesManager();

      expect(await prefs2.getDefaultLLMProvider()).toBe('anthropic');
      expect(await prefs2.getDefaultLLMModel()).toBe('claude-3-opus');
      expect(await prefs2.getDefaultAutomationTemplate()).toBe('custom');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const prefs1 = getPreferencesManager();
      const prefs2 = getPreferencesManager();

      expect(prefs1).toBe(prefs2);
    });

    it('should return new instance after reset', () => {
      const prefs1 = getPreferencesManager();
      resetPreferencesManager();
      const prefs2 = getPreferencesManager();

      expect(prefs1).not.toBe(prefs2);
    });
  });

  describe('step automation preferences', () => {
    it('should set step automation preference', async () => {
      const prefsManager = getPreferencesManager();

      await prefsManager.setStepAutomationPreference(
        'step-01-brainstorming' as any,
        'manual'
      );

      const pref = await prefsManager.getStepAutomationPreference(
        'step-01-brainstorming' as any
      );
      expect(pref).toBe('manual');
    });

    it('should return undefined for unset step preference', async () => {
      const prefsManager = getPreferencesManager();

      const pref = await prefsManager.getStepAutomationPreference(
        'step-05-ux-design' as any
      );
      expect(pref).toBeUndefined();
    });

    it('should get all step automation preferences', async () => {
      const prefsManager = getPreferencesManager();

      await prefsManager.setStepAutomationPreference(
        'step-01-brainstorming' as any,
        'auto'
      );
      await prefsManager.setStepAutomationPreference(
        'step-02-research' as any,
        'manual'
      );

      const allPrefs = await prefsManager.getAllStepAutomationPreferences();
      expect(allPrefs['step-01-brainstorming']).toBe('auto');
      expect(allPrefs['step-02-research']).toBe('manual');
    });

    it('should set all step automation preferences at once', async () => {
      const prefsManager = getPreferencesManager();

      await prefsManager.setAllStepAutomationPreferences({
        'step-01-brainstorming': 'auto',
        'step-02-research': 'manual',
        'step-03-product-brief': 'skip',
      });

      const allPrefs = await prefsManager.getAllStepAutomationPreferences();
      expect(allPrefs['step-01-brainstorming']).toBe('auto');
      expect(allPrefs['step-02-research']).toBe('manual');
      expect(allPrefs['step-03-product-brief']).toBe('skip');
    });

    it('should clear all step automation preferences', async () => {
      const prefsManager = getPreferencesManager();

      await prefsManager.setAllStepAutomationPreferences({
        'step-01-brainstorming': 'manual',
      });

      await prefsManager.clearStepAutomationPreferences();

      const allPrefs = await prefsManager.getAllStepAutomationPreferences();
      expect(Object.keys(allPrefs).length).toBe(0);
    });

    it('should save workflow preferences from Map', async () => {
      const prefsManager = getPreferencesManager();

      const stepModes = new Map<any, any>([
        ['step-01-brainstorming', 'auto'],
        ['step-02-research', 'manual'],
      ]);

      await prefsManager.saveWorkflowPreferences(stepModes);

      const allPrefs = await prefsManager.getAllStepAutomationPreferences();
      expect(allPrefs['step-01-brainstorming']).toBe('auto');
      expect(allPrefs['step-02-research']).toBe('manual');
    });

    it('should persist step preferences across instances', async () => {
      const prefs1 = getPreferencesManager();
      await prefs1.setStepAutomationPreference(
        'step-04-prd' as any,
        'manual'
      );

      resetPreferencesManager();

      const prefs2 = getPreferencesManager();
      const pref = await prefs2.getStepAutomationPreference(
        'step-04-prd' as any
      );
      expect(pref).toBe('manual');
    });
  });
});
