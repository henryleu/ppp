import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface Settings {
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

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function getUserPppPath(): string {
  return join(homedir(), '.ppp');
}

export function getSettingsPath(): string {
  return join(getUserPppPath(), 'settings.json');
}

export async function loadSettings(): Promise<Settings | null> {
  try {
    const settingsPath = getSettingsPath();
    if (!(await fileExists(settingsPath))) {
      return null;
    }
    
    const settingsContent = await readFile(settingsPath, 'utf-8');
    return JSON.parse(settingsContent) as Settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const settingsPath = getSettingsPath();
    settings.lastUpdated = new Date().toISOString();
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

export async function isFirstRun(): Promise<boolean> {
  const settings = await loadSettings();
  return settings?.firstRun === true;
}

export async function setFirstRunComplete(): Promise<void> {
  const settings = await loadSettings();
  if (settings) {
    settings.firstRun = false;
    await saveSettings(settings);
  }
}