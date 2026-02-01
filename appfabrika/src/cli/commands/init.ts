/**
 * Init Command Handler
 * Starts a new BMAD project
 */

import * as p from '@clack/prompts';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ProjectState, LLMProvider, AutomationTemplate, ProjectConfig } from '../../types/index.js';

/**
 * Derives a kebab-case project name from the user's idea
 * @param idea - User's project idea
 * @returns Sanitized folder name
 */
export function deriveProjectName(idea: string): string {
  return idea
    .toLowerCase()
    .trim()
    .replace(/[ğ]/g, 'g')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Executes the init command flow
 * Shows welcome message and collects project information
 */
export async function initCommand(): Promise<void> {
  p.intro('🏭 AppFabrika - BMAD Proje Başlatıcı');

  // Story 2.2 - Idea input
  const idea = await p.text({
    message: 'Proje fikrinizi tek cümlede açıklayın:',
    placeholder: 'örn: Restoran rezervasyon uygulaması',
    validate: (value) => {
      if (!value || !value.trim()) {
        return 'Proje fikri boş olamaz';
      }
    },
  });

  if (p.isCancel(idea)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  // Story 2.3 - LLM provider selection
  const llmProvider = await p.select({
    message: 'Hangi LLM sağlayıcısını kullanmak istersiniz?',
    options: [
      { value: 'openai', label: 'OpenAI (GPT-4)' },
      { value: 'anthropic', label: 'Anthropic (Claude)' },
    ],
  });

  if (p.isCancel(llmProvider)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  // Story 2.4 - Automation template selection
  const automationTemplate = await p.select({
    message: 'Otomasyon seviyesini seçin:',
    options: [
      {
        value: 'full-auto',
        label: 'Hızlı Başla (Full Auto)',
        hint: 'Tüm adımlar otomatik çalışır',
      },
      {
        value: 'checkpoint',
        label: 'Adım Adım (Checkpoint)',
        hint: 'Her adımda onay istenir',
      },
    ],
  });

  if (p.isCancel(automationTemplate)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  // Story 2.5 - Project folder creation
  const projectName = deriveProjectName(idea.trim());
  const projectPath = join(process.cwd(), projectName);

  // Check if folder already exists
  if (existsSync(projectPath)) {
    p.cancel(`Klasör zaten mevcut: ${projectPath}`);
    process.exit(1);
  }

  // Create folder structure
  const appfabrikaPath = join(projectPath, '.appfabrika');
  const checkpointsPath = join(appfabrikaPath, 'checkpoints');

  await mkdir(checkpointsPath, { recursive: true });

  // Create config.json
  const config: ProjectConfig = {
    version: '1.0.0',
    projectName,
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
    automationTemplate: automationTemplate as AutomationTemplate,
    createdAt: new Date().toISOString(),
  };

  await writeFile(
    join(appfabrikaPath, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  const state: ProjectState = {
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
    automationTemplate: automationTemplate as AutomationTemplate,
    projectPath,
  };

  p.outro(`✓ Proje oluşturuldu: ${state.projectPath}`);
}
