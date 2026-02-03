#!/usr/bin/env node

/**
 * AppFabrika CLI Entry Point
 * BMAD metodolojisi ile urun gelistirme CLI araci
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { startCommand } from './commands/start.js';

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

program.parse();
