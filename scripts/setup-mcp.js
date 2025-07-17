#!/usr/bin/env node

import { writeFile, readFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import prompts from 'prompts';

const MCP_CONFIGS = {
  vscode: {
    name: 'VSCode/Cursor/Trae/Cline',
    path: '.vscode/mcp.json',
    config: {
      servers: {
        ppp: {
          type: 'stdio',
          command: 'ppp',
          args: ['--mcp-server'],
          description: 'Product Prompt Planner - CLI tool for managing product backlogs, tasks and bugs with AI assistance'
        }
      }
    }
  },
  claudeCode: {
    name: 'Claude Code',
    path: join(homedir(), '.claude.json'),
    config: {
      mcpServers: {
        ppp: {
          type: 'stdio',
          command: 'ppp',
          args: ['--mcp-server'],
          description: 'Product Prompt Planner - CLI tool for managing product backlogs, tasks and bugs with AI assistance'
        }
      }
    }
  },
};

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function setupMCP(ideType) {
  const config = MCP_CONFIGS[ideType];
  const configPath = config.path;
  
  try {
    // Create directory if it doesn't exist
    const dir = configPath.includes('/') ? configPath.substring(0, configPath.lastIndexOf('/')) : '.';
    await mkdir(dir, { recursive: true });
    
    let existingConfig = {};
    
    // Read existing config if it exists
    if (await fileExists(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        existingConfig = JSON.parse(content);
        console.log(`📁 Found existing configuration at ${configPath}`);
      } catch (error) {
        console.log(`⚠️  Error reading existing config: ${error.message}`);
      }
    }
    
    // Merge configurations
    let mergedConfig;
    if (ideType === 'vscode') {
      mergedConfig = {
        ...existingConfig,
        servers: {
          ...existingConfig.servers,
          ...config.config.servers
        }
      };
    } else {
      mergedConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          ...config.config.mcpServers
        }
      };
    }
    
    // Write configuration
    await writeFile(configPath, JSON.stringify(mergedConfig, null, 2));
    
    console.log(`✅ Successfully configured PPP MCP for ${config.name}`);
    console.log(`📄 Configuration saved to: ${configPath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error setting up MCP for ${config.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 PPP MCP Setup Tool');
  console.log('');
  
  const questions = [
    {
      type: 'multiselect',
      name: 'ides',
      message: 'Which IDEs would you like to configure?',
      choices: [
        { title: 'VSCode/Cursor/Trae/Cline (.vscode/mcp.json)', value: 'vscode' },
        { title: 'Claude Code (~/.claude.json)', value: 'claudeCode' }
      ],
      min: 1
    }
  ];
  
  const response = await prompts(questions);
  
  if (!response.ides || response.ides.length === 0) {
    console.log('❌ No IDEs selected. Exiting.');
    return;
  }
  
  console.log('');
  console.log('🔧 Setting up MCP configurations...');
  console.log('');
  
  let successCount = 0;
  
  for (const ide of response.ides) {
    const success = await setupMCP(ide);
    if (success) successCount++;
    console.log('');
  }
  
  console.log(`🎉 Setup complete! Successfully configured ${successCount}/${response.ides.length} IDEs.`);
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Make sure PPP is installed globally: npm install -g @ppp/cli');
  console.log('2. Restart your IDE to load the MCP server');
  console.log('3. Test the configuration:');
  console.log('   - VSCode/Cursor: Check MCP status in your IDE');
  console.log('   - Claude Code: Use /mcp command to verify');
  console.log('');
}

main().catch(console.error);