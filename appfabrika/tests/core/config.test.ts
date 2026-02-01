import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, rm, readFile, stat, writeFile } from 'fs/promises';
import { tmpdir, platform } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import {
  AppConfig,
  CONFIG_VERSION,
  createDefaultConfig,
  isValidConfig,
  DEFAULT_CONFIG,
} from '../../src/types/config.types.js';

// Create a test config manager with custom path
class TestConfigManager extends ConfigManager {
  private testDir: string;

  constructor(testDir: string) {
    super();
    this.testDir = testDir;
  }

  override getConfigDir(): string {
    return this.testDir;
  }

  override getConfigPath(): string {
    return join(this.testDir, 'config.json');
  }
}

describe('Config Types', () => {
  describe('createDefaultConfig', () => {
    it('should create config with correct version', () => {
      const config = createDefaultConfig();
      expect(config.version).toBe(CONFIG_VERSION);
    });

    it('should create config with default LLM settings', () => {
      const config = createDefaultConfig();
      expect(config.llm.provider).toBe('openai');
      expect(config.llm.model).toBe('gpt-4');
    });

    it('should create config with default UI settings', () => {
      const config = createDefaultConfig();
      expect(config.ui.style).toBe('friendly');
      expect(config.ui.language).toBe('tr');
    });

    it('should create config with default automation settings', () => {
      const config = createDefaultConfig();
      expect(config.automation.defaultTemplate).toBe('full-auto');
    });

    it('should create config with ISO 8601 timestamps', () => {
      const config = createDefaultConfig();
      expect(config.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(config.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('isValidConfig', () => {
    it('should return true for valid config', () => {
      const config = createDefaultConfig();
      expect(isValidConfig(config)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidConfig(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidConfig('string')).toBe(false);
      expect(isValidConfig(123)).toBe(false);
    });

    it('should return false for missing version', () => {
      const config = createDefaultConfig();
      delete (config as Record<string, unknown>).version;
      expect(isValidConfig(config)).toBe(false);
    });

    it('should return false for missing llm', () => {
      const config = createDefaultConfig();
      delete (config as Record<string, unknown>).llm;
      expect(isValidConfig(config)).toBe(false);
    });

    it('should return false for missing timestamps', () => {
      const config = createDefaultConfig();
      delete (config as Record<string, unknown>).createdAt;
      expect(isValidConfig(config)).toBe(false);
    });

    it('should return false for invalid LLM provider', () => {
      const config = createDefaultConfig();
      (config.llm as Record<string, unknown>).provider = 'azure';
      expect(isValidConfig(config)).toBe(false);
    });

    it('should return false for invalid UI style', () => {
      const config = createDefaultConfig();
      (config.ui as Record<string, unknown>).style = 'dark';
      expect(isValidConfig(config)).toBe(false);
    });

    it('should return false for invalid automation template', () => {
      const config = createDefaultConfig();
      (config.automation as Record<string, unknown>).defaultTemplate = 'invalid-template';
      expect(isValidConfig(config)).toBe(false);
    });
  });
});

describe('ConfigManager', () => {
  let testDir: string;
  let configManager: TestConfigManager;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `appfabrika-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    configManager = new TestConfigManager(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getConfigDir', () => {
    it('should return the test directory', () => {
      expect(configManager.getConfigDir()).toBe(testDir);
    });
  });

  describe('getConfigPath', () => {
    it('should return path to config.json', () => {
      expect(configManager.getConfigPath()).toBe(join(testDir, 'config.json'));
    });
  });

  describe('exists', () => {
    it('should return false when config does not exist', async () => {
      expect(await configManager.exists()).toBe(false);
    });

    it('should return true when config exists', async () => {
      const config = createDefaultConfig();
      await writeFile(configManager.getConfigPath(), JSON.stringify(config));
      expect(await configManager.exists()).toBe(true);
    });
  });

  describe('load', () => {
    it('should create new config when none exists', async () => {
      const { config, isNew } = await configManager.load();

      expect(isNew).toBe(true);
      expect(config.version).toBe(CONFIG_VERSION);
      expect(config.llm.provider).toBe('openai');
    });

    it('should load existing config', async () => {
      // Create a config file first with valid values
      const existingConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        llm: { provider: 'anthropic', model: 'claude-3-opus' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await writeFile(configManager.getConfigPath(), JSON.stringify(existingConfig));

      const { config, isNew } = await configManager.load();

      expect(isNew).toBe(false);
      expect(config.llm.provider).toBe('anthropic');
      expect(config.llm.model).toBe('claude-3-opus');
    });

    it('should create config file on disk', async () => {
      await configManager.load();

      const exists = await configManager.exists();
      expect(exists).toBe(true);
    });

    it('should create new config when existing config is corrupted JSON', async () => {
      // Write corrupted JSON
      await writeFile(configManager.getConfigPath(), '{ invalid json }');

      const { config, isNew } = await configManager.load();

      expect(isNew).toBe(true);
      expect(config.version).toBe(CONFIG_VERSION);
    });

    it('should create new config when existing config has invalid structure', async () => {
      // Write valid JSON but invalid config structure
      await writeFile(configManager.getConfigPath(), JSON.stringify({ foo: 'bar' }));

      const { config, isNew } = await configManager.load();

      expect(isNew).toBe(true);
      expect(config.version).toBe(CONFIG_VERSION);
    });

    it('should create new config when existing config has invalid provider value', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        llm: { provider: 'azure', model: 'gpt-4' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await writeFile(configManager.getConfigPath(), JSON.stringify(invalidConfig));

      const { config, isNew } = await configManager.load();

      expect(isNew).toBe(true);
      expect(config.llm.provider).toBe('openai');
    });
  });

  describe('save', () => {
    it('should save config to disk', async () => {
      const config = createDefaultConfig();
      await configManager.save(config);

      const content = await readFile(configManager.getConfigPath(), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.version).toBe(config.version);
      expect(saved.llm.provider).toBe(config.llm.provider);
    });

    it('should save config with proper formatting', async () => {
      const config = createDefaultConfig();
      await configManager.save(config);

      const content = await readFile(configManager.getConfigPath(), 'utf-8');
      // Should be formatted with 2-space indentation
      expect(content).toContain('  "version"');
    });
  });

  describe('update', () => {
    it('should update LLM settings', async () => {
      await configManager.load();

      const updated = await configManager.update({
        llm: { provider: 'anthropic' },
      });

      expect(updated.llm.provider).toBe('anthropic');
      expect(updated.llm.model).toBe('gpt-4'); // unchanged
    });

    it('should update UI settings', async () => {
      await configManager.load();

      const updated = await configManager.update({
        ui: { style: 'minimal' },
      });

      expect(updated.ui.style).toBe('minimal');
      expect(updated.ui.language).toBe('tr'); // unchanged
    });

    it('should update updatedAt timestamp', async () => {
      const { config: original } = await configManager.load();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await configManager.update({
        llm: { model: 'gpt-4-turbo' },
      });

      expect(updated.updatedAt).not.toBe(original.updatedAt);
    });

    it('should persist updates to disk', async () => {
      await configManager.load();
      await configManager.update({
        automation: { defaultTemplate: 'full-manuel' },
      });

      // Load fresh from disk
      const newManager = new TestConfigManager(testDir);
      const { config } = await newManager.load();

      expect(config.automation.defaultTemplate).toBe('full-manuel');
    });

    it('should preserve createdAt timestamp on update', async () => {
      const { config: original } = await configManager.load();
      const originalCreatedAt = original.createdAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await configManager.update({
        llm: { model: 'gpt-4-turbo' },
      });

      expect(updated.createdAt).toBe(originalCreatedAt);
    });
  });

  describe('get', () => {
    it('should return config after load', async () => {
      await configManager.load();
      const config = await configManager.get();

      expect(config.version).toBe(CONFIG_VERSION);
    });

    it('should load config if not loaded', async () => {
      const config = await configManager.get();

      expect(config.version).toBe(CONFIG_VERSION);
    });
  });

  describe('getDefault', () => {
    it('should return default config without saving', async () => {
      const defaultConfig = configManager.getDefault();

      expect(defaultConfig.version).toBe(CONFIG_VERSION);
      expect(await configManager.exists()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset config to defaults', async () => {
      await configManager.load();
      await configManager.update({
        llm: { provider: 'anthropic', model: 'claude-3' },
      });

      const reset = await configManager.reset();

      expect(reset.llm.provider).toBe('openai');
      expect(reset.llm.model).toBe('gpt-4');
    });
  });

  // Unix-only tests for file permissions
  if (platform() !== 'win32') {
    describe('file permissions (Unix)', () => {
      it('should set config file permissions to 600', async () => {
        await configManager.load();

        const stats = await stat(configManager.getConfigPath());
        const mode = stats.mode & 0o777;

        expect(mode).toBe(0o600);
      });

      it('should set config directory permissions to 700', async () => {
        await configManager.load();

        const stats = await stat(configManager.getConfigDir());
        const mode = stats.mode & 0o777;

        expect(mode).toBe(0o700);
      });
    });
  }
});
