#!/usr/bin/env bun

import { program } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { startMCPServer } from './mcp/server.js';
import { isFirstRun } from './utils/settings.js';
import { handleFirstRun } from './utils/welcome.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Check if we should start MCP server mode
if (process.argv.includes('--mcp-server')) {
  startMCPServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
} else {
  // Regular CLI mode
  program
    .name('ppp')
    .description('Product Prompt Planner - CLI tool for managing product backlogs, tasks and bugs')
    .version(packageJson.version, '-v, --version', 'output the current version');

  program
    .option('--mcp-server', 'Start MCP server mode for AI integration')
    .description('When --mcp-server is used, starts MCP stdio server for AI assistants');

  program
    .command('init')
    .description('Initialize ppp in current directory')
    .action(initCommand);

  program
    .command('generate')
    .description('Generate project artifacts')
    .action(() => {
      console.log('Generating...');
      // TODO: Implement ppp generate functionality
    });

  // Check for first run before parsing commands
  const checkFirstRun = async () => {
    if (await isFirstRun()) {
      await handleFirstRun();
    }
  };

  // If no command was provided, show help and exit gracefully
  if (process.argv.length <= 2) {
    checkFirstRun().then(() => {
      program.outputHelp();
      process.exit(0);
    });
  } else {
    checkFirstRun().then(() => {
      program.parse();
    });
  }
}
