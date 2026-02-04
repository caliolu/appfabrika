/**
 * BMAD Config Loader
 * Loads configuration from _bmad/bmm/config.yaml
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface BmadConfig {
  user_name: string;
  communication_language: string;
  output_folder: string;
  project_root?: string;
  // Custom fields
  [key: string]: string | undefined;
}

const DEFAULT_CONFIG: BmadConfig = {
  user_name: process.env.USER || 'User',
  communication_language: 'Turkish',
  output_folder: 'docs',
};

let cachedConfig: BmadConfig | null = null;
let configPath: string | null = null;

/**
 * Load BMAD configuration from yaml file
 */
export async function loadBmadConfig(bmadRoot: string): Promise<BmadConfig> {
  const configFile = join(bmadRoot, 'bmm', 'config.yaml');

  // Return cached config if same path
  if (cachedConfig && configPath === configFile) {
    return cachedConfig;
  }

  if (!existsSync(configFile)) {
    console.warn(`⚠️ Config dosyası bulunamadı: ${configFile}`);
    console.warn('   Varsayılan ayarlar kullanılıyor.');
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configFile, 'utf-8');
    const parsed = parseYaml(content) as Partial<BmadConfig>;

    cachedConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      project_root: bmadRoot.replace('/_bmad', ''),
    };
    configPath = configFile;

    return cachedConfig;
  } catch (error) {
    console.error('Config yükleme hatası:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get cached config or default
 */
export function getConfig(): BmadConfig {
  return cachedConfig || DEFAULT_CONFIG;
}

/**
 * Get user name from config
 */
export function getUserName(): string {
  return getConfig().user_name;
}

/**
 * Get communication language from config
 */
export function getLanguage(): string {
  return getConfig().communication_language;
}

/**
 * Get output folder from config
 */
export function getOutputFolder(): string {
  return getConfig().output_folder;
}

/**
 * Clear cached config (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configPath = null;
}

/**
 * Resolve config variables in a string
 * Replaces {config_source}: prefixed values
 */
export function resolveConfigVariables(
  content: string,
  config: BmadConfig
): string {
  let resolved = content;

  // Replace {config_source}:variable patterns
  const pattern = /\{config_source\}:(\w+)/g;
  resolved = resolved.replace(pattern, (_, key) => {
    return config[key] || `{${key}}`;
  });

  // Replace direct {{variable}} patterns
  for (const [key, value] of Object.entries(config)) {
    if (value) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resolved = resolved.replace(regex, value);
    }
  }

  return resolved;
}
