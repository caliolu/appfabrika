/**
 * API Key Types and Validation
 * Defines types and validation for LLM provider API keys
 */

export type ApiKeyType = 'openai' | 'anthropic';
export type ApiKeyTypeWithUnknown = ApiKeyType | 'unknown';

export interface ApiKeyInfo {
  type: ApiKeyTypeWithUnknown;
  key: string;
  maskedKey: string;
  isValid: boolean;
}

// Environment variable names for API keys
export const API_KEY_ENV_NAMES = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
} as const;

/**
 * OpenAI API key pattern
 * Supports multiple formats:
 * - Legacy: sk-[alphanumeric, 32+ chars]
 * - Project keys: sk-proj-[alphanumeric with dashes/underscores]
 * - Service account: sk-svcacct-[alphanumeric with dashes/underscores]
 * Note: Uses negative lookahead to exclude Anthropic keys (sk-ant-)
 */
const OPENAI_KEY_PATTERN = /^sk-(?!ant-)(?:proj-|svcacct-)?[a-zA-Z0-9_-]{32,}$/;

/**
 * Anthropic API key pattern
 * Format: sk-ant-[alphanumeric with dashes/underscores, 32+ chars]
 */
const ANTHROPIC_KEY_PATTERN = /^sk-ant-[a-zA-Z0-9_-]{32,}$/;

/**
 * Validates an OpenAI API key format
 */
export function isValidOpenAIKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return OPENAI_KEY_PATTERN.test(key.trim());
}

/**
 * Validates an Anthropic API key format
 */
export function isValidAnthropicKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return ANTHROPIC_KEY_PATTERN.test(key.trim());
}

/**
 * Detects the type of API key based on its format
 */
export function detectApiKeyType(key: string): ApiKeyType | null {
  if (isValidOpenAIKey(key)) {
    return 'openai';
  }
  if (isValidAnthropicKey(key)) {
    return 'anthropic';
  }
  return null;
}

/**
 * Masks an API key for safe display
 * Shows first 4 and last 4 characters
 */
export function maskApiKey(key: string): string {
  if (!key || typeof key !== 'string') {
    return '****';
  }
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Creates an ApiKeyInfo object with validation and masking
 * @param key - The API key string
 * @param type - Optional type override. If not provided, type is auto-detected.
 * @returns ApiKeyInfo with type='unknown' if key format is not recognized
 */
export function createApiKeyInfo(key: string, type?: ApiKeyType): ApiKeyInfo {
  const detectedType = type || detectApiKeyType(key);
  const isValid = detectedType === 'openai'
    ? isValidOpenAIKey(key)
    : detectedType === 'anthropic'
      ? isValidAnthropicKey(key)
      : false;

  return {
    type: detectedType || 'unknown',
    key,
    maskedKey: maskApiKey(key),
    isValid,
  };
}
