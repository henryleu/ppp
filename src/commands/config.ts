import { Command } from 'commander';
import { createTable } from '../utils/table.js';
import { 
  loadConfig, 
  getConfigValue, 
  setConfigValue, 
  VALID_CONFIG_KEYS, 
  getConfigLevelName,
  PppConfig
} from '../utils/config.js';

export function createConfigCommand(): Command {
  const configCommand = new Command('config');
  configCommand.description('Manage ppp configuration');

  // ppp config list
  configCommand
    .command('list')
    .description('List all configuration items')
    .option('-g, --global', 'Use global configuration (~/.ppp/settings.json)')
    .action(async (options) => {
      try {
        const isGlobal = options.global || false;
        const config = await loadConfig(isGlobal);
        const configLevel = getConfigLevelName(isGlobal);
        
        const table = createTable({
          head: ['Config Item', 'Value'],
          colWidths: [25, 40]
        });

        // Add all config items to table
        VALID_CONFIG_KEYS.forEach(key => {
          const value = config[key as keyof PppConfig];
          // Hide sensitive values
          const displayValue = key === 'llm_api_key' && value 
            ? '*'.repeat(Math.min(value.toString().length, 20))
            : value;
          table.push([key, displayValue.toString()]);
        });

        console.log(`\n${configLevel} Configuration:\n`);
        console.log(table.toString());
        console.log();
      } catch (error) {
        console.error(`[ERROR] Failed to list config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // ppp config get
  configCommand
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key to retrieve')
    .option('-g, --global', 'Use global configuration (~/.ppp/settings.json)')
    .action(async (key, options) => {
      try {
        const isGlobal = options.global || false;
        const value = await getConfigValue(key, isGlobal);
        const configLevel = getConfigLevelName(isGlobal);
        
        // Hide sensitive values
        const displayValue = key === 'llm_api_key' && value 
          ? '*'.repeat(Math.min(value.toString().length, 20))
          : value;
        
        console.log(`[${configLevel}] ${key}: ${displayValue}`);
      } catch (error) {
        console.error(`[ERROR] Failed to get config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // ppp config set
  configCommand
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key to set')
    .argument('<value>', 'Value to set')
    .option('-g, --global', 'Use global configuration (~/.ppp/settings.json)')
    .action(async (key, value, options) => {
      try {
        const isGlobal = options.global || false;
        await setConfigValue(key, value, isGlobal);
        const configLevel = getConfigLevelName(isGlobal);
        
        // Hide sensitive values in confirmation
        const displayValue = key === 'llm_api_key' && value 
          ? '*'.repeat(Math.min(value.length, 20))
          : value;
        
        console.log(`[OK] ${configLevel} config updated: ${key} = ${displayValue}`);
      } catch (error) {
        console.error(`[ERROR] Failed to set config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  return configCommand;
}

export async function configCommand() {
  // This is a placeholder - the actual command handling is done by Commander.js
  // through the createConfigCommand() function above
}