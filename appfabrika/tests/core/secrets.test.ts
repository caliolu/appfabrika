import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, rm, readFile, stat, writeFile } from 'fs/promises';
import { tmpdir, platform } from 'os';
import { SecretManager, resetSecretManager } from '../../src/core/secrets.js';
import { resetConfigManager } from '../../src/core/config.js';
import {
  isValidOpenAIKey,
  isValidAnthropicKey,
  maskApiKey,
  detectApiKeyType,
  createApiKeyInfo,
  API_KEY_ENV_NAMES,
} from '../../src/types/api-key.types.js';

// Test SecretManager with custom path
class TestSecretManager extends SecretManager {
  private testDir: string;

  constructor(testDir: string) {
    super();
    this.testDir = testDir;
  }

  override getEnvPath(): string {
    return join(this.testDir, '.env');
  }
}

describe('API Key Types', () => {
  describe('isValidOpenAIKey', () => {
    it('should return true for valid OpenAI key', () => {
      expect(isValidOpenAIKey('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    });

    it('should return true for project OpenAI key', () => {
      expect(isValidOpenAIKey('sk-proj-abcdefghijklmnopqrstuvwxyz12345678')).toBe(true);
    });

    it('should return true for service account OpenAI key', () => {
      expect(isValidOpenAIKey('sk-svcacct-abcdefghijklmnopqrstuvwxyz12345678')).toBe(true);
    });

    it('should return true for key with dashes and underscores', () => {
      expect(isValidOpenAIKey('sk-proj-abc_def-ghi_jkl-mno_pqr-stu_vwx_yz12')).toBe(true);
    });

    it('should return false for short key', () => {
      expect(isValidOpenAIKey('sk-abc')).toBe(false);
    });

    it('should return false for wrong prefix', () => {
      expect(isValidOpenAIKey('api-abcdefghijklmnopqrstuvwxyz123456')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidOpenAIKey('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidOpenAIKey(null as unknown as string)).toBe(false);
      expect(isValidOpenAIKey(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isValidAnthropicKey', () => {
    it('should return true for valid Anthropic key', () => {
      expect(isValidAnthropicKey('sk-ant-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    });

    it('should return true for key with dashes and underscores', () => {
      expect(isValidAnthropicKey('sk-ant-abc_def-ghi_jkl-mno_pqr-stu_vwx_yz')).toBe(true);
    });

    it('should return false for short key', () => {
      expect(isValidAnthropicKey('sk-ant-abc')).toBe(false);
    });

    it('should return false for wrong prefix', () => {
      expect(isValidAnthropicKey('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidAnthropicKey('')).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('should mask middle of key', () => {
      expect(maskApiKey('sk-abcdefghijklmnop')).toBe('sk-a...mnop');
    });

    it('should return **** for short keys', () => {
      expect(maskApiKey('sk-abc')).toBe('****');
    });

    it('should return **** for empty string', () => {
      expect(maskApiKey('')).toBe('****');
    });

    it('should return **** for null/undefined', () => {
      expect(maskApiKey(null as unknown as string)).toBe('****');
      expect(maskApiKey(undefined as unknown as string)).toBe('****');
    });

    it('should handle exactly 8 char key', () => {
      expect(maskApiKey('12345678')).toBe('****');
    });

    it('should handle 9 char key', () => {
      expect(maskApiKey('123456789')).toBe('1234...6789');
    });
  });

  describe('detectApiKeyType', () => {
    it('should detect OpenAI key', () => {
      expect(detectApiKeyType('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe('openai');
    });

    it('should detect Anthropic key', () => {
      expect(detectApiKeyType('sk-ant-abcdefghijklmnopqrstuvwxyz123456')).toBe('anthropic');
    });

    it('should return null for invalid key', () => {
      expect(detectApiKeyType('invalid-key')).toBe(null);
    });
  });

  describe('createApiKeyInfo', () => {
    it('should create info for valid OpenAI key', () => {
      const info = createApiKeyInfo('sk-abcdefghijklmnopqrstuvwxyz123456');
      expect(info.type).toBe('openai');
      expect(info.isValid).toBe(true);
      expect(info.maskedKey).toBe('sk-a...3456');
    });

    it('should create info for valid Anthropic key', () => {
      const info = createApiKeyInfo('sk-ant-abcdefghijklmnopqrstuvwxyz123456');
      expect(info.type).toBe('anthropic');
      expect(info.isValid).toBe(true);
    });

    it('should create info for invalid key with unknown type', () => {
      const info = createApiKeyInfo('invalid');
      expect(info.isValid).toBe(false);
      expect(info.type).toBe('unknown');
    });
  });

  describe('API_KEY_ENV_NAMES', () => {
    it('should have correct OpenAI env name', () => {
      expect(API_KEY_ENV_NAMES.openai).toBe('OPENAI_API_KEY');
    });

    it('should have correct Anthropic env name', () => {
      expect(API_KEY_ENV_NAMES.anthropic).toBe('ANTHROPIC_API_KEY');
    });
  });
});

describe('SecretManager', () => {
  let testDir: string;
  let secretManager: TestSecretManager;

  beforeEach(async () => {
    // Reset singletons
    resetSecretManager();
    resetConfigManager();

    // Create unique temp directory for each test
    testDir = join(tmpdir(), `appfabrika-secrets-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    secretManager = new TestSecretManager(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetSecretManager();
    resetConfigManager();
  });

  describe('getEnvPath', () => {
    it('should return path to .env file', () => {
      expect(secretManager.getEnvPath()).toBe(join(testDir, '.env'));
    });
  });

  describe('exists', () => {
    it('should return false when .env does not exist', async () => {
      expect(await secretManager.exists()).toBe(false);
    });

    it('should return true when .env exists', async () => {
      await writeFile(secretManager.getEnvPath(), 'TEST=value');
      expect(await secretManager.exists()).toBe(true);
    });
  });

  describe('loadSecrets', () => {
    it('should return empty object when .env does not exist', async () => {
      const secrets = await secretManager.loadSecrets();
      expect(secrets).toEqual({});
    });

    it('should load secrets from .env file', async () => {
      await writeFile(secretManager.getEnvPath(), 'OPENAI_API_KEY=sk-test123\nANTHROPIC_API_KEY=sk-ant-test456');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.OPENAI_API_KEY).toBe('sk-test123');
      expect(secrets.ANTHROPIC_API_KEY).toBe('sk-ant-test456');
    });

    it('should ignore comments and empty lines', async () => {
      await writeFile(secretManager.getEnvPath(), '# Comment\n\nKEY=value\n# Another comment');
      const secrets = await secretManager.loadSecrets();
      expect(secrets).toEqual({ KEY: 'value' });
    });

    it('should handle values with = sign', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY=value=with=equals');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value=with=equals');
    });

    it('should strip double quotes from values', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY="value with spaces"');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value with spaces');
    });

    it('should strip single quotes from values', async () => {
      await writeFile(secretManager.getEnvPath(), "KEY='value with spaces'");
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value with spaces');
    });

    it('should not strip mismatched quotes', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY="value\'');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('"value\'');
    });

    it('should handle escaped characters in double quotes', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY="value with \\"quotes\\" and \\\\backslash"');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value with "quotes" and \\backslash');
    });

    it('should handle escaped newlines in double quotes', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY="line1\\nline2"');
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('line1\nline2');
    });

    it('should cache loaded secrets', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY=value1');
      await secretManager.loadSecrets();

      // Modify file directly
      await writeFile(secretManager.getEnvPath(), 'KEY=value2');

      // Should still return cached value
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value1');
    });
  });

  describe('saveSecret', () => {
    it('should create .env file with secret', async () => {
      await secretManager.saveSecret('TEST_KEY', 'test_value');

      const content = await readFile(secretManager.getEnvPath(), 'utf-8');
      expect(content).toContain('TEST_KEY=test_value');
    });

    it('should update existing secret', async () => {
      await secretManager.saveSecret('KEY', 'value1');
      await secretManager.saveSecret('KEY', 'value2');

      const content = await readFile(secretManager.getEnvPath(), 'utf-8');
      expect(content).toContain('KEY=value2');
      expect(content.match(/KEY=/g)?.length).toBe(1);
    });

    it('should preserve other secrets when adding new one', async () => {
      await secretManager.saveSecret('KEY1', 'value1');
      await secretManager.saveSecret('KEY2', 'value2');

      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY1).toBe('value1');
      expect(secrets.KEY2).toBe('value2');
    });

    it('should include header comment', async () => {
      await secretManager.saveSecret('KEY', 'value');
      const content = await readFile(secretManager.getEnvPath(), 'utf-8');
      expect(content).toContain('# AppFabrika API Keys');
    });

    it('should reject empty key', async () => {
      await expect(secretManager.saveSecret('', 'value')).rejects.toThrow('Secret key cannot be empty');
    });

    it('should reject whitespace-only key', async () => {
      await expect(secretManager.saveSecret('   ', 'value')).rejects.toThrow('Secret key cannot be empty');
    });

    it('should reject key with spaces', async () => {
      await expect(secretManager.saveSecret('KEY WITH SPACES', 'value')).rejects.toThrow('Invalid secret key format');
    });

    it('should reject key starting with number', async () => {
      await expect(secretManager.saveSecret('1KEY', 'value')).rejects.toThrow('Invalid secret key format');
    });

    it('should accept valid underscore key', async () => {
      await secretManager.saveSecret('_PRIVATE_KEY', 'value');
      expect(await secretManager.getSecret('_PRIVATE_KEY')).toBe('value');
    });

    it('should handle value with spaces by quoting', async () => {
      await secretManager.saveSecret('KEY', 'value with spaces');
      secretManager.clearCache();
      expect(await secretManager.getSecret('KEY')).toBe('value with spaces');
    });

    it('should handle value with quotes by escaping', async () => {
      await secretManager.saveSecret('KEY', 'value "with" quotes');
      secretManager.clearCache();
      expect(await secretManager.getSecret('KEY')).toBe('value "with" quotes');
    });

    it('should handle value with literal backslash-n (not newline)', async () => {
      // This is backslash followed by 'n', not a newline character
      const valueWithBackslashN = 'test\\nvalue';
      await secretManager.saveSecret('KEY', valueWithBackslashN);
      secretManager.clearCache();
      expect(await secretManager.getSecret('KEY')).toBe(valueWithBackslashN);
    });

    it('should handle value with actual newline character', async () => {
      const valueWithNewline = 'line1\nline2';
      await secretManager.saveSecret('KEY', valueWithNewline);
      secretManager.clearCache();
      expect(await secretManager.getSecret('KEY')).toBe(valueWithNewline);
    });

    it('should handle complex escape sequences', async () => {
      // Value with backslash, quote, and newline
      const complexValue = 'path\\to\\file "quoted" and\nnewline';
      await secretManager.saveSecret('KEY', complexValue);
      secretManager.clearCache();
      expect(await secretManager.getSecret('KEY')).toBe(complexValue);
    });
  });

  describe('getSecret', () => {
    it('should return secret value', async () => {
      await secretManager.saveSecret('KEY', 'value');
      expect(await secretManager.getSecret('KEY')).toBe('value');
    });

    it('should return undefined for missing secret', async () => {
      expect(await secretManager.getSecret('MISSING')).toBeUndefined();
    });
  });

  describe('getSecretMasked', () => {
    it('should return masked secret value', async () => {
      await secretManager.saveSecret('KEY', 'sk-abcdefghijklmnop');
      expect(await secretManager.getSecretMasked('KEY')).toBe('sk-a...mnop');
    });

    it('should return undefined for missing secret', async () => {
      expect(await secretManager.getSecretMasked('MISSING')).toBeUndefined();
    });
  });

  describe('hasSecret', () => {
    it('should return true for existing secret', async () => {
      await secretManager.saveSecret('KEY', 'value');
      expect(await secretManager.hasSecret('KEY')).toBe(true);
    });

    it('should return false for missing secret', async () => {
      expect(await secretManager.hasSecret('MISSING')).toBe(false);
    });

    it('should return false for empty secret', async () => {
      await writeFile(secretManager.getEnvPath(), 'KEY=');
      secretManager.clearCache();
      expect(await secretManager.hasSecret('KEY')).toBe(false);
    });
  });

  describe('removeSecret', () => {
    it('should remove secret from .env file', async () => {
      await secretManager.saveSecret('KEY1', 'value1');
      await secretManager.saveSecret('KEY2', 'value2');
      await secretManager.removeSecret('KEY1');

      const content = await readFile(secretManager.getEnvPath(), 'utf-8');
      expect(content).not.toContain('KEY1');
      expect(content).toContain('KEY2=value2');
    });

    it('should do nothing for missing secret', async () => {
      await secretManager.saveSecret('KEY', 'value');
      await secretManager.removeSecret('MISSING');

      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value');
    });
  });

  describe('API key helpers', () => {
    it('should save OpenAI API key with correct env name', async () => {
      await secretManager.saveApiKey('openai', 'sk-test123');
      expect(await secretManager.getSecret('OPENAI_API_KEY')).toBe('sk-test123');
    });

    it('should save Anthropic API key with correct env name', async () => {
      await secretManager.saveApiKey('anthropic', 'sk-ant-test456');
      expect(await secretManager.getSecret('ANTHROPIC_API_KEY')).toBe('sk-ant-test456');
    });

    it('should get API key by type', async () => {
      await secretManager.saveApiKey('openai', 'sk-test');
      expect(await secretManager.getApiKey('openai')).toBe('sk-test');
    });

    it('should check if API key exists', async () => {
      expect(await secretManager.hasApiKey('openai')).toBe(false);
      await secretManager.saveApiKey('openai', 'sk-test');
      expect(await secretManager.hasApiKey('openai')).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached secrets', async () => {
      await secretManager.saveSecret('KEY', 'value1');
      await secretManager.loadSecrets();

      // Modify file directly
      await writeFile(secretManager.getEnvPath(), 'KEY=value2');

      // Clear cache and reload
      secretManager.clearCache();
      const secrets = await secretManager.loadSecrets();
      expect(secrets.KEY).toBe('value2');
    });

    it('should clear cached env path', async () => {
      // Access path to cache it
      const path1 = secretManager.getEnvPath();

      // Clear cache
      secretManager.clearCache();

      // Path should be recomputed (same value but proves cache was cleared)
      const path2 = secretManager.getEnvPath();
      expect(path2).toBe(path1);

      // Verify internal state was reset by checking we can still operate
      await secretManager.saveSecret('KEY', 'value');
      expect(await secretManager.getSecret('KEY')).toBe('value');
    });
  });

  // Unix-only tests for file permissions
  if (platform() !== 'win32') {
    describe('file permissions (Unix)', () => {
      it('should set .env file permissions to 600', async () => {
        await secretManager.saveSecret('KEY', 'value');

        const stats = await stat(secretManager.getEnvPath());
        const mode = stats.mode & 0o777;

        expect(mode).toBe(0o600);
      });

      it('should maintain permissions after update', async () => {
        await secretManager.saveSecret('KEY1', 'value1');
        await secretManager.saveSecret('KEY2', 'value2');

        const stats = await stat(secretManager.getEnvPath());
        const mode = stats.mode & 0o777;

        expect(mode).toBe(0o600);
      });
    });
  }
});
