/**
 * ConfigManager - Manages AppFabrika configuration
 * Location: ~/.appfabrika/config.json
 */

import { homedir, platform } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, chmod, access, constants } from 'fs/promises';
import {
  AppConfig,
  createDefaultConfig,
  isValidConfig,
  type LLMConfig,
  type UIConfig,
  type AutomationConfig,
} from '../types/config.types.js';

const CONFIG_DIR_NAME = '.appfabrika';
const CONFIG_FILE_NAME = 'config.json';

export class ConfigManager {
  private config: AppConfig | null = null;
  private _configDir: string | null = null;
  private _configPath: string | null = null;

  constructor() {
    // Lazy initialization - will be set on first access
  }

  private get configDir(): string {
    if (!this._configDir) {
      this._configDir = this.getConfigDir();
    }
    return this._configDir;
  }

  private get configPath(): string {
    if (!this._configPath) {
      this._configPath = this.getConfigPath();
    }
    return this._configPath;
  }

  /**
   * Returns the config directory path (~/.appfabrika)
   */
  getConfigDir(): string {
    return join(homedir(), CONFIG_DIR_NAME);
  }

  /**
   * Returns the config file path (~/.appfabrika/config.json)
   */
  getConfigPath(): string {
    return join(this.getConfigDir(), CONFIG_FILE_NAME);
  }

  /**
   * Ensures the config directory exists with proper permissions
   */
  async ensureConfigDir(): Promise<void> {
    try {
      await access(this.configDir, constants.F_OK);
    } catch {
      // Directory doesn't exist, create it
      await mkdir(this.configDir, { recursive: true });
    }

    // Always set directory permissions to 700 (owner only) on Unix systems
    if (platform() !== 'win32') {
      await chmod(this.configDir, 0o700);
    }
  }

  /**
   * Checks if config file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.configPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads the config from file, or creates default if not exists
   * Returns { config, isNew } to indicate if a new config was created
   */
  async load(): Promise<{ config: AppConfig; isNew: boolean }> {
    await this.ensureConfigDir();

    const configExists = await this.exists();

    if (configExists) {
      try {
        const content = await readFile(this.configPath, 'utf-8');
        const parsed = JSON.parse(content);

        if (!isValidConfig(parsed)) {
          throw new Error('Invalid config structure');
        }

        this.config = parsed;
        return { config: this.config, isNew: false };
      } catch (error) {
        // Config file is corrupted or invalid, create new one
        // TODO: Replace with Logger when Logger module is implemented (Story 1.x)
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Config file corrupted (${message}), creating new config...`);
      }
    }

    // Create new config with defaults
    this.config = createDefaultConfig();
    await this.save(this.config);
    return { config: this.config, isNew: true };
  }

  /**
   * Saves config to file with secure permissions
   */
  async save(config: AppConfig): Promise<void> {
    await this.ensureConfigDir();

    const content = JSON.stringify(config, null, 2);
    await writeFile(this.configPath, content, 'utf-8');

    // Set file permissions to 600 (owner read/write only) on Unix systems
    if (platform() !== 'win32') {
      await chmod(this.configPath, 0o600);
    }

    this.config = config;
  }

  /**
   * Updates config with partial values and saves
   */
  async update(partial: Partial<{
    llm: Partial<LLMConfig>;
    ui: Partial<UIConfig>;
    automation: Partial<AutomationConfig>;
  }>): Promise<AppConfig> {
    if (!this.config) {
      await this.load();
    }

    const updatedConfig: AppConfig = {
      ...this.config!,
      llm: { ...this.config!.llm, ...partial.llm },
      ui: { ...this.config!.ui, ...partial.ui },
      automation: { ...this.config!.automation, ...partial.automation },
      updatedAt: new Date().toISOString(),
    };

    await this.save(updatedConfig);
    return updatedConfig;
  }

  /**
   * Returns the current config (loads if not loaded)
   */
  async get(): Promise<AppConfig> {
    if (!this.config) {
      const { config } = await this.load();
      return config;
    }
    return this.config;
  }

  /**
   * Returns a new default config (without saving)
   */
  getDefault(): AppConfig {
    return createDefaultConfig();
  }

  /**
   * Resets config to defaults
   */
  async reset(): Promise<AppConfig> {
    const newConfig = createDefaultConfig();
    await this.save(newConfig);
    return newConfig;
  }
}

// Singleton instance for convenience
let instance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetConfigManager(): void {
  instance = null;
}

export { AppConfig, isValidConfig, createDefaultConfig };
