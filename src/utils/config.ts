import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { fileExists } from './settings.js';

export interface PppConfig {
  llm_api_key: string;
  llm_api_url: string;
  llm_api_model: string;
  llm_api_temperature: number;
  llm_api_max_tokens: number;
  llm_api_top_p: number;
}

export const DEFAULT_CONFIG: PppConfig = {
  llm_api_key: '',
  llm_api_url: 'https://api.moonshot.cn/v1',
  llm_api_model: 'kimi-k2-0711-preview',
  llm_api_temperature: 0.7,
  llm_api_max_tokens: 1000,
  llm_api_top_p: 1
};

export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);

export function getConfigPath(isGlobal: boolean): string {
  if (isGlobal) {
    return join(homedir(), '.ppp', 'settings.json');
  } else {
    return join(process.cwd(), '.ppp', 'settings.json');
  }
}

export function getConfigDir(isGlobal: boolean): string {
  if (isGlobal) {
    return join(homedir(), '.ppp');
  } else {
    return join(process.cwd(), '.ppp');
  }
}

export async function ensureConfigExists(isGlobal: boolean): Promise<void> {
  const configDir = getConfigDir(isGlobal);
  const configPath = getConfigPath(isGlobal);
  
  try {
    // Ensure directory exists
    await mkdir(configDir, { recursive: true });
    
    // Check if config file exists
    if (!(await fileExists(configPath))) {
      // Create default config
      await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  } catch (error) {
    throw new Error(`Failed to create config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadConfig(isGlobal: boolean): Promise<PppConfig> {
  const configPath = getConfigPath(isGlobal);
  
  try {
    if (!(await fileExists(configPath))) {
      if (!isGlobal) {
        throw new Error('Project config not found. Run "ppp init" first or use --global flag for user-level config.');
      }
      await ensureConfigExists(isGlobal);
    }
    
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Merge with defaults to handle missing keys
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Project config not found')) {
      throw error;
    }
    throw new Error(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function saveConfig(config: PppConfig, isGlobal: boolean): Promise<void> {
  const configPath = getConfigPath(isGlobal);
  
  try {
    await ensureConfigExists(isGlobal);
    await writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getConfigValue(key: string, isGlobal: boolean): Promise<string | number> {
  if (!VALID_CONFIG_KEYS.includes(key)) {
    throw new Error(`Invalid config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(', ')}`);
  }
  
  const config = await loadConfig(isGlobal);
  return config[key as keyof PppConfig];
}

export async function setConfigValue(key: string, value: string, isGlobal: boolean): Promise<void> {
  if (!VALID_CONFIG_KEYS.includes(key)) {
    throw new Error(`Invalid config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(', ')}`);
  }
  
  const config = await loadConfig(isGlobal);
  
  // Type validation and conversion
  if (key === 'llm_api_temperature' || key === 'llm_api_top_p') {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 1) {
      throw new Error(`${key} must be a number between 0 and 1`);
    }
    config[key as keyof PppConfig] = numValue as any;
  } else if (key === 'llm_api_max_tokens') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
    config[key as keyof PppConfig] = numValue as any;
  } else {
    // String values
    config[key as keyof PppConfig] = value as any;
  }
  
  await saveConfig(config, isGlobal);
}

export function getConfigLevelName(isGlobal: boolean): string {
  return isGlobal ? 'Global' : 'Project';
}