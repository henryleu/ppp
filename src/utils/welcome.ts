import prompts from 'prompts';
import { createTable } from './table.js';
import { loadSettings, saveSettings, setFirstRunComplete, getUserPppPath } from './settings.js';

export async function showWelcomeMessage(): Promise<void> {
  console.log('');
  console.log('[WELCOME] Welcome to PPP (Product Prompt Planner)!');
  console.log('');
  console.log('PPP is your AI-assisted command-line tool for managing');
  console.log('product backlogs, tasks, and bugs with structured markdown files.');
  console.log('');
  console.log('[INFO] Your personal PPP configuration is located at:');
  console.log(`   ${getUserPppPath()}`);
  console.log('');
  
  const table = createTable({
    head: ['File', 'Purpose'],
    colWidths: [20, 50]
  });

  table.push(
    ['settings.json', 'Your personal PPP preferences and configuration'],
    ['README.md', 'User guide and documentation'],
    ['TRACK.md', 'Personal task tracking template'],
    ['SPEC.md', 'Project specification template'],
    ['IMPL.md', 'Implementation notes template']
  );

  console.log(table.toString());
  console.log('');
}

export async function runFirstTimeSetup(): Promise<void> {
  console.log('[SETUP] Let\'s configure your PPP preferences:');
  console.log('');

  const questions = [
    {
      type: 'text' as const,
      name: 'defaultProjectPath',
      message: 'Default project path (where you keep your projects):',
      initial: '~/projects'
    },
    {
      type: 'confirm' as const,
      name: 'autoBackup',
      message: 'Enable automatic backup of project files?',
      initial: true
    },
    {
      type: 'confirm' as const,
      name: 'showTips',
      message: 'Show helpful tips and suggestions?',
      initial: true
    },
    {
      type: 'confirm' as const,
      name: 'aiEnabled',
      message: 'Enable AI integration features?',
      initial: true
    },
    {
      type: 'confirm' as const,
      name: 'mcpIntegration',
      message: 'Enable MCP integration for AI assistants?',
      initial: true
    }
  ];

  const response = await prompts(questions);

  // If user cancelled, use defaults
  if (!response.defaultProjectPath) {
    console.log('');
    console.log('[WARNING] Setup cancelled. Using default settings.');
    console.log('   You can change these later by editing ~/.ppp/settings.json');
    console.log('');
    await setFirstRunComplete();
    return;
  }

  // Update settings with user preferences
  const settings = await loadSettings();
  if (settings) {
    settings.preferences.defaultProjectPath = response.defaultProjectPath;
    settings.preferences.autoBackup = response.autoBackup;
    settings.preferences.showTips = response.showTips;
    settings.ai.enabled = response.aiEnabled;
    settings.ai.mcpIntegration = response.mcpIntegration;
    
    await saveSettings(settings);
  }

  console.log('');
  console.log('[OK] PPP configuration complete!');
  console.log('');
  console.log('[INFO] Quick start:');
  console.log('   • Run "ppp init" in a project directory to initialize PPP');
  console.log('   • Run "ppp --help" to see all available commands');
  console.log('   • Check ~/.ppp/README.md for detailed usage instructions');
  console.log('');
  console.log('[AI] For AI integration:');
  console.log('   • Run "ppp --mcp-server" to start MCP server mode');
  console.log('   • Configure your AI assistant to use PPP via MCP');
  console.log('');

  await setFirstRunComplete();
}

export async function handleFirstRun(): Promise<void> {
  await showWelcomeMessage();
  await runFirstTimeSetup();
}