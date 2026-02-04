#!/usr/bin/env node

/**
 * AppFabrika CLI Entry Point
 * BMAD metodolojisi ile urun gelistirme CLI araci
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { startCommand } from './commands/start.js';
import { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import {
  runBmadHelp,
  runIndexDocs,
  runShardDoc,
  runSingleWorkflow,
  listWorkflows,
} from '../bmad/orchestrator.js';

const program = new Command();

program
  .name('appfabrika')
  .description('BMAD metodolojisi ile ürün geliştirme CLI aracı')
  .version('0.1.0');

// Default action - run start command when no command specified
program
  .action(async () => {
    // If no command provided, run start
    await startCommand.parseAsync(['node', 'appfabrika', 'start']);
  });

// Add start command (main command)
program.addCommand(startCommand);

// Legacy commands (still available)
program
  .command('init')
  .description('Yeni bir BMAD projesi başlat (eski)')
  .action(initCommand);

program.addCommand(runCommand);

// Help command - BMAD help system
program
  .command('help-bmad [topic]')
  .description('BMAD yardım sistemi - workflow, agent veya konsept hakkında bilgi al')
  .action(async (topic?: string) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      p.log.error('ANTHROPIC_API_KEY çevre değişkeni bulunamadı.');
      process.exit(1);
    }

    const adapter = new AnthropicAdapter({ apiKey });
    const helpTopic = topic || 'genel bmad kullanımı';

    await runBmadHelp(helpTopic, adapter);
  });

// List workflows command
program
  .command('list')
  .description('Tüm BMAD workflow\'larını listele')
  .action(() => {
    listWorkflows();
  });

// Single workflow command
program
  .command('workflow <id>')
  .description('Tek bir workflow çalıştır')
  .option('-p, --path <path>', 'Proje dizini', process.cwd())
  .option('-n, --name <name>', 'Proje adı')
  .option('-i, --idea <idea>', 'Proje fikri')
  .option('-a, --auto', 'Otomatik mod (interaktif soru sormadan)')
  .action(async (id: string, options) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      p.log.error('ANTHROPIC_API_KEY çevre değişkeni bulunamadı.');
      process.exit(1);
    }

    const adapter = new AnthropicAdapter({ apiKey });
    const projectPath = options.path;
    const projectName = options.name || 'Proje';
    const idea = options.idea || 'Proje fikri';
    const mode = options.auto ? 'auto' : 'interactive';

    // If name or idea not provided, ask interactively
    let finalName = projectName;
    let finalIdea = idea;

    if (!options.name && !options.auto) {
      const nameInput = await p.text({
        message: 'Proje adı:',
        placeholder: 'Proje adını gir',
      });
      if (!p.isCancel(nameInput)) {
        finalName = nameInput as string;
      }
    }

    if (!options.idea && !options.auto) {
      const ideaInput = await p.text({
        message: 'Proje fikri:',
        placeholder: 'Projenin ana fikrini açıkla',
      });
      if (!p.isCancel(ideaInput)) {
        finalIdea = ideaInput as string;
      }
    }

    const success = await runSingleWorkflow(
      id,
      projectPath,
      finalName,
      finalIdea,
      adapter,
      mode
    );

    process.exit(success ? 0 : 1);
  });

// Docs commands
const docsCommand = new Command('docs')
  .description('Doküman araçları');

docsCommand
  .command('index')
  .description('docs/ klasöründeki tüm dokümanları indeksle')
  .option('-p, --path <path>', 'Proje dizini', process.cwd())
  .action(async (options) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      p.log.error('ANTHROPIC_API_KEY çevre değişkeni bulunamadı.');
      process.exit(1);
    }

    const adapter = new AnthropicAdapter({ apiKey });
    await runIndexDocs(options.path, adapter);
  });

docsCommand
  .command('shard <file>')
  .description('Büyük bir dokümanı parçalara ayır')
  .action(async (file: string) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      p.log.error('ANTHROPIC_API_KEY çevre değişkeni bulunamadı.');
      process.exit(1);
    }

    const adapter = new AnthropicAdapter({ apiKey });
    await runShardDoc(file, adapter);
  });

program.addCommand(docsCommand);

program.parse();
