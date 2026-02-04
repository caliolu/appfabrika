/**
 * Config Loader Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import {
  loadBmadConfig,
  getConfig,
  getUserName,
  getLanguage,
  getOutputFolder,
  clearConfigCache,
  resolveConfigVariables,
} from '../config-loader.js';

const TEST_DIR = join(process.cwd(), '.test-config');
const TEST_BMAD_DIR = join(TEST_DIR, '_bmad');

describe('Config Loader', () => {
  beforeEach(async () => {
    clearConfigCache();
    await mkdir(join(TEST_BMAD_DIR, 'bmm'), { recursive: true });
  });

  afterEach(async () => {
    clearConfigCache();
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadBmadConfig', () => {
    it('should return default config when file does not exist', async () => {
      const config = await loadBmadConfig(join(TEST_DIR, 'nonexistent'));

      expect(config.communication_language).toBe('Turkish');
      expect(config.output_folder).toBe('docs');
    });

    it('should load config from yaml file', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `
user_name: TestUser
communication_language: English
output_folder: output
custom_field: custom_value
`);

      const config = await loadBmadConfig(TEST_BMAD_DIR);

      expect(config.user_name).toBe('TestUser');
      expect(config.communication_language).toBe('English');
      expect(config.output_folder).toBe('output');
      expect(config.custom_field).toBe('custom_value');
    });

    it('should cache loaded config', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `user_name: CachedUser`);

      const config1 = await loadBmadConfig(TEST_BMAD_DIR);
      const config2 = await loadBmadConfig(TEST_BMAD_DIR);

      expect(config1).toBe(config2); // Same reference
    });

    it('should set project_root from bmadRoot', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `user_name: TestUser`);

      const config = await loadBmadConfig(TEST_BMAD_DIR);

      expect(config.project_root).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return default config when not loaded', () => {
      const config = getConfig();

      expect(config.communication_language).toBe('Turkish');
    });
  });

  describe('getUserName', () => {
    it('should return user name from config', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `user_name: TestUser`);
      await loadBmadConfig(TEST_BMAD_DIR);

      expect(getUserName()).toBe('TestUser');
    });
  });

  describe('getLanguage', () => {
    it('should return language from config', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `communication_language: German`);
      await loadBmadConfig(TEST_BMAD_DIR);

      expect(getLanguage()).toBe('German');
    });
  });

  describe('getOutputFolder', () => {
    it('should return output folder from config', async () => {
      const configPath = join(TEST_BMAD_DIR, 'bmm', 'config.yaml');
      await writeFile(configPath, `output_folder: custom-output`);
      await loadBmadConfig(TEST_BMAD_DIR);

      expect(getOutputFolder()).toBe('custom-output');
    });
  });

  describe('resolveConfigVariables', () => {
    it('should resolve {config_source}:variable patterns', () => {
      const config = {
        user_name: 'John',
        communication_language: 'English',
        output_folder: 'docs',
      };

      const content = 'Hello {config_source}:user_name!';
      const resolved = resolveConfigVariables(content, config);

      expect(resolved).toBe('Hello John!');
    });

    it('should resolve {{variable}} patterns', () => {
      const config = {
        user_name: 'Jane',
        communication_language: 'Turkish',
        output_folder: 'docs',
      };

      const content = 'Welcome {{user_name}} to {{output_folder}}';
      const resolved = resolveConfigVariables(content, config);

      expect(resolved).toBe('Welcome Jane to docs');
    });

    it('should keep unresolved variables as placeholders', () => {
      const config = {
        user_name: 'Test',
        communication_language: 'Turkish',
        output_folder: 'docs',
      };

      const content = 'Value: {config_source}:unknown_var';
      const resolved = resolveConfigVariables(content, config);

      expect(resolved).toBe('Value: {unknown_var}');
    });
  });
});
