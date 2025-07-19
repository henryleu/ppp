#!/usr/bin/env bun

import { program } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { createConfigCommand } from './commands/config.js';
import { createKeywordsCommand } from './commands/keywords.js';
import { createIssueCommand } from './commands/issue.js';
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

  // Add config command with subcommands
  program.addCommand(createConfigCommand());

  // Add keywords command for LLM-powered keyword generation
  program.addCommand(createKeywordsCommand());

  // Add issue command for issue management
  program.addCommand(createIssueCommand());

  program
    .command('generate')
    .description('Generate project artifacts')
    .action(() => {
      console.log('Generating...');
      // TODO: Implement ppp generate functionality
    });

  program
    .command('setup-mcp')
    .description('Setup MCP configuration for your IDE')
    .action(async () => {
      const { spawn } = await import('child_process');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const scriptPath = join(__dirname, '..', 'scripts', 'setup-mcp.js');
      
      spawn('node', [scriptPath], { 
        stdio: 'inherit',
        shell: true
      });
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
