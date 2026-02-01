/**
 * SecretManager - Manages API keys and secrets
 * Location: ~/.appfabrika/.env
 */

import { platform } from 'os';
import { join } from 'path';
import { readFile, writeFile, chmod, access, constants } from 'fs/promises';
import { getConfigManager } from './config.js';
import { maskApiKey, API_KEY_ENV_NAMES, type ApiKeyType } from '../types/api-key.types.js';

const ENV_FILE_NAME = '.env';

/**
 * Parses a .env file content into a key-value object
 * Supports quoted values: KEY="value" or KEY='value'
 * Handles escape sequences in double-quoted values (single-pass processing):
 * - \n → newline
 * - \\ → backslash
 * - \" → quote
 */
function parseEnvFile(content: string): Record<string, string> {
  const secrets: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Split on first = only (value may contain =)
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    // Strip surrounding quotes and handle escape sequences
    if (value.startsWith('"') && value.endsWith('"')) {
      // Single-pass escape processing to handle sequences correctly
      value = value.slice(1, -1).replace(/\\(.)/g, (_, char) => {
        switch (char) {
          case 'n': return '\n';
          case '"': return '"';
          case '\\': return '\\';
          default: return '\\' + char; // Unknown escape, keep as-is
        }
      });
    } else if (value.startsWith("'") && value.endsWith("'")) {
      // Single quotes: no escape processing (literal)
      value = value.slice(1, -1);
    }
    if (key) {
      secrets[key] = value;
    }
  }
  return secrets;
}

/**
 * Serializes secrets object to .env file format
 * Values containing spaces, quotes, or special chars are double-quoted
 */
function serializeEnvFile(secrets: Record<string, string>): string {
  const header = `# AppFabrika API Keys
# Generated: ${new Date().toISOString().split('T')[0]}
# WARNING: Keep this file secure - chmod 600

`;
  const lines = Object.entries(secrets)
    .map(([key, value]) => {
      // Quote values that contain spaces, quotes, or special characters
      const needsQuotes = /[\s"'#=\\]/.test(value) || value.includes('\n');
      if (needsQuotes) {
        // Escape existing double quotes and wrap in double quotes
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return `${key}="${escaped}"`;
      }
      return `${key}=${value}`;
    })
    .join('\n');
  return header + lines + '\n';
}

export class SecretManager {
  private secrets: Record<string, string> | null = null;
  private _envPath: string | null = null;

  constructor() {
    // Lazy initialization
  }

  /**
   * Returns the .env file path (~/.appfabrika/.env)
   */
  getEnvPath(): string {
    if (!this._envPath) {
      const configManager = getConfigManager();
      this._envPath = join(configManager.getConfigDir(), ENV_FILE_NAME);
    }
    return this._envPath;
  }

  /**
   * Ensures the config directory exists (reuses ConfigManager)
   */
  private async ensureConfigDir(): Promise<void> {
    const configManager = getConfigManager();
    await configManager.ensureConfigDir();
  }

  /**
   * Checks if .env file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.getEnvPath(), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads secrets from .env file
   * Returns empty object if file doesn't exist
   */
  async loadSecrets(): Promise<Record<string, string>> {
    if (this.secrets !== null) {
      return { ...this.secrets };
    }

    const envPath = this.getEnvPath();

    try {
      await access(envPath, constants.F_OK);
      const content = await readFile(envPath, 'utf-8');
      this.secrets = parseEnvFile(content);
    } catch {
      // File doesn't exist, return empty
      this.secrets = {};
    }

    return { ...this.secrets };
  }

  /**
   * Saves a secret to .env file
   * Creates file if it doesn't exist
   * @param key - Must be a valid env variable name (alphanumeric + underscore, not starting with number)
   * @param value - The secret value
   * @throws Error if key is empty or contains invalid characters
   */
  async saveSecret(key: string, value: string): Promise<void> {
    // Validate key format (standard env variable naming)
    if (!key || typeof key !== 'string') {
      throw new Error('Secret key cannot be empty');
    }
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      throw new Error('Secret key cannot be empty');
    }
    // Env variable names: alphanumeric + underscore, not starting with a number
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedKey)) {
      throw new Error(`Invalid secret key format: "${key}". Use only letters, numbers, and underscores (cannot start with number)`);
    }

    await this.ensureConfigDir();

    // Load existing secrets
    await this.loadSecrets();

    // Update secret (use trimmed key for consistency)
    this.secrets![trimmedKey] = value;

    // Write to file
    const content = serializeEnvFile(this.secrets!);
    const envPath = this.getEnvPath();
    await writeFile(envPath, content, 'utf-8');

    // Set secure permissions (chmod 600) on Unix systems
    if (platform() !== 'win32') {
      await chmod(envPath, 0o600);
    }
  }

  /**
   * Retrieves a secret by key
   * Returns undefined if not found
   */
  async getSecret(key: string): Promise<string | undefined> {
    const secrets = await this.loadSecrets();
    return secrets[key];
  }

  /**
   * Retrieves a secret with masked output option
   */
  async getSecretMasked(key: string): Promise<string | undefined> {
    const secret = await this.getSecret(key);
    if (secret) {
      return maskApiKey(secret);
    }
    return undefined;
  }

  /**
   * Checks if a secret exists
   */
  async hasSecret(key: string): Promise<boolean> {
    const secrets = await this.loadSecrets();
    return key in secrets && secrets[key] !== '';
  }

  /**
   * Removes a secret from .env file
   * @param key - The key name to remove
   * @remarks If the key doesn't exist, this is a no-op (no error thrown)
   * @remarks File permissions (chmod 600) are maintained after removal
   */
  async removeSecret(key: string): Promise<void> {
    await this.loadSecrets();

    if (this.secrets && key in this.secrets) {
      delete this.secrets[key];

      const content = serializeEnvFile(this.secrets);
      const envPath = this.getEnvPath();
      await writeFile(envPath, content, 'utf-8');

      // Maintain secure permissions
      if (platform() !== 'win32') {
        await chmod(envPath, 0o600);
      }
    }
  }

  /**
   * Saves an API key with the correct environment variable name
   */
  async saveApiKey(type: ApiKeyType, key: string): Promise<void> {
    const envName = API_KEY_ENV_NAMES[type];
    await this.saveSecret(envName, key);
  }

  /**
   * Gets an API key by provider type
   */
  async getApiKey(type: ApiKeyType): Promise<string | undefined> {
    const envName = API_KEY_ENV_NAMES[type];
    return this.getSecret(envName);
  }

  /**
   * Checks if an API key exists for a provider
   */
  async hasApiKey(type: ApiKeyType): Promise<boolean> {
    const envName = API_KEY_ENV_NAMES[type];
    return this.hasSecret(envName);
  }

  /**
   * Clears cached secrets and path (useful for testing)
   */
  clearCache(): void {
    this.secrets = null;
    this._envPath = null;
  }
}

// Singleton instance
let instance: SecretManager | null = null;

export function getSecretManager(): SecretManager {
  if (!instance) {
    instance = new SecretManager();
  }
  return instance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetSecretManager(): void {
  instance = null;
}

// Re-export for convenience
export { maskApiKey } from '../types/api-key.types.js';
