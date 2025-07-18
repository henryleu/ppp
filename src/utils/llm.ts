import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { loadConfig } from './config.js';

export interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/**
 * Load LLM configuration from global or project config
 */
export async function loadLLMConfig(useGlobal: boolean = true): Promise<LLMConfig> {
  const config = await loadConfig(useGlobal);
  
  return {
    apiKey: config.llm_api_key,
    apiUrl: config.llm_api_url,
    model: config.llm_api_model,
    temperature: config.llm_api_temperature,
    maxTokens: config.llm_api_max_tokens,
    topP: config.llm_api_top_p
  };
}

/**
 * Create OpenAI instance with custom configuration
 */
export function createLLMClient(config: LLMConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
  });
}

/**
 * Sanitize keywords for use in file/folder names
 */
export function sanitizeKeywords(keywords: string): string {
  return keywords
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_') // Replace hyphens with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .slice(0, 50); // Max 50 characters
}

/**
 * Generate issue name keywords using LLM
 */
export async function generateIssueNameKeywords(
  issueName: string,
  useGlobal: boolean = true
): Promise<string> {
  if (!issueName || issueName.trim().length === 0) {
    throw new Error('Issue name cannot be empty');
  }

  try {
    const config = await loadLLMConfig(useGlobal);
    
    if (!config.apiKey) {
      throw new Error('LLM API key not configured. Run "ppp config set llm_api_key <key>" first.');
    }

    const client = createLLMClient(config);

    const prompt = `Generate 2-4 short, descriptive keywords from this issue name for use in file/folder naming.

Requirements:
- Focus on key technical/functional concepts
- Use lowercase words only
- Separate with spaces (will be converted to underscores)
- Keep total length under 40 characters
- Be concise but descriptive
- Avoid redundant words like "create", "add", "implement" unless essential

Issue name: "${issueName}"

Keywords:`;

    const result = await generateText({
      model: client(config.model),
      prompt: prompt,
      temperature: config.temperature,
      maxTokens: 50, // Short response needed
      topP: config.topP,
    });

    const keywords = result.text.trim();
    
    if (!keywords) {
      throw new Error('LLM returned empty keywords');
    }

    return sanitizeKeywords(keywords);
  } catch (error) {
    console.warn(`LLM keyword generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Fallback to simple text processing
    return generateFallbackKeywords(issueName);
  }
}

/**
 * Fallback keyword generation using simple text processing
 */
export function generateFallbackKeywords(issueName: string): string {
  const commonWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
    'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'create', 'add', 'implement',
    'make', 'build', 'develop', 'setup', 'set', 'up', 'new', 'fix', 'update', 'modify', 'change'
  ]);

  const words = issueName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 4); // Take first 4 meaningful words

  const keywords = words.join(' ');
  return sanitizeKeywords(keywords);
}

/**
 * Test function for keyword generation
 */
export async function testKeywordGeneration(testApiKey?: string): Promise<void> {
  console.log('\n=== Testing Issue Name Keywords Generation ===\n');

  // Test cases
  const testCases = [
    'Create user authentication system',
    'Fix bug in payment processing module',
    'Admin dashboard for user management',
    'Implement OAuth2 login integration',
    'Database migration for user profiles',
    'Add real-time notifications feature',
    'Security audit and vulnerability fixes',
    'Mobile app responsive design improvements',
    'API rate limiting implementation',
    'User registration email verification'
  ];

  // Set test API key if provided
  if (testApiKey) {
    try {
      const { setConfigValue } = await import('./config.js');
      await setConfigValue('llm_api_key', testApiKey, true);
      console.log('✓ Test API key configured\n');
    } catch (error) {
      console.error('Failed to set test API key:', error);
      return;
    }
  }

  for (const testCase of testCases) {
    try {
      const keywords = await generateIssueNameKeywords(testCase, true);
      console.log(`Issue: "${testCase}"`);
      console.log(`Keywords: "${keywords}"`);
      console.log(`Length: ${keywords.length} characters`);
      console.log('---');
    } catch (error) {
      console.error(`Failed for "${testCase}":`, error instanceof Error ? error.message : 'Unknown error');
      console.log('---');
    }
  }

  console.log('\n=== Testing Fallback Keywords ===\n');
  
  for (const testCase of testCases.slice(0, 3)) {
    const fallbackKeywords = generateFallbackKeywords(testCase);
    console.log(`Issue: "${testCase}"`);
    console.log(`Fallback: "${fallbackKeywords}"`);
    console.log(`Length: ${fallbackKeywords.length} characters`);
    console.log('---');
  }
}