#!/usr/bin/env bun

import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Settings {
  firstRun: boolean;
  version: string;
  preferences: {
    defaultProjectPath: string;
    autoBackup: boolean;
    theme: string;
    showTips: boolean;
  };
  ai: {
    enabled: boolean;
    mcpIntegration: boolean;
    autoSuggest: boolean;
  };
  tracking: {
    enableTimeTracking: boolean;
    defaultPriority: string;
    autoArchive: boolean;
  };
  created: string;
  lastUpdated: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyTemplateFile(templatePath: string, targetPath: string): Promise<void> {
  try {
    if (await fileExists(targetPath)) {
      console.log(`  ✓ ${targetPath} already exists`);
      return;
    }

    const templateContent = await readFile(templatePath, 'utf-8');
    await writeFile(targetPath, templateContent);
    console.log(`  ✓ Created ${targetPath}`);
  } catch (error) {
    console.error(`  ✗ Failed to copy ${templatePath} to ${targetPath}:`, error);
  }
}

async function createUserPppDirectory(): Promise<void> {
  const userPppDir = join(homedir(), '.ppp');
  const templateDir = join(__dirname, 'templates', 'user-ppp');
  
  try {
    console.log('[SETUP] Setting up PPP user directory...');
    
    // Create ~/.ppp directory if it doesn't exist
    if (!(await fileExists(userPppDir))) {
      await mkdir(userPppDir, { recursive: true });
      console.log(`  ✓ Created ${userPppDir}`);
    } else {
      console.log(`  ✓ ${userPppDir} already exists`);
    }

    // Handle settings.json with special logic
    const settingsPath = join(userPppDir, 'settings.json');
    if (!(await fileExists(settingsPath))) {
      const templateSettings = await readFile(join(templateDir, 'settings.json'), 'utf-8');
      const settings: Settings = JSON.parse(templateSettings);
      
      // Update timestamps
      const now = new Date().toISOString();
      settings.created = now;
      settings.lastUpdated = now;
      settings.firstRun = true;
      
      await writeFile(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`  ✓ Created ${settingsPath}`);
    } else {
      // Check if existing settings has firstRun flag
      try {
        const existingSettings = JSON.parse(await readFile(settingsPath, 'utf-8'));
        if (existingSettings.firstRun === undefined) {
          existingSettings.firstRun = true;
          existingSettings.lastUpdated = new Date().toISOString();
          await writeFile(settingsPath, JSON.stringify(existingSettings, null, 2));
          console.log(`  ✓ Updated ${settingsPath} with firstRun flag`);
        } else {
          console.log(`  ✓ ${settingsPath} already exists with firstRun flag`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to update existing settings:`, error);
      }
    }

    // Copy template files
    const templateFiles = ['README.md', 'TRACK.md', 'SPEC.md', 'IMPL.md'];
    
    for (const file of templateFiles) {
      const templatePath = join(templateDir, file);
      const targetPath = join(userPppDir, file);
      await copyTemplateFile(templatePath, targetPath);
    }

    console.log('');
    console.log('[OK] PPP user directory setup complete!');
    console.log(`[INFO] Your PPP configuration is in: ${userPppDir}`);
    console.log('');
    console.log('[INFO] Next steps:');
    console.log('  - Run "ppp --help" to see available commands');
    console.log('  - Run "ppp init" in a project directory to get started');
    console.log('  - Check ~/.ppp/README.md for detailed usage instructions');
    console.log('');

  } catch (error) {
    console.error('[ERROR] Error setting up PPP user directory:', error);
    process.exit(1);
  }
}

// Run the post-install setup
createUserPppDirectory().catch((error) => {
  console.error('[ERROR] Post-install setup failed:', error);
  process.exit(1);
});