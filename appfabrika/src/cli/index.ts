#!/usr/bin/env node

/**
 * AppFabrika CLI Entry Point
 * BMAD metodolojisi ile urun gelistirme CLI araci
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('appfabrika')
  .description('BMAD metodolojisi ile ürün geliştirme CLI aracı')
  .version('0.1.0');

program
  .command('init')
  .description('Yeni bir BMAD projesi başlat')
  .action(initCommand);

program.parse();
