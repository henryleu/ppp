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
 * Check if text contains Chinese characters
 */
export function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * Get display length accounting for Chinese characters (which are wider)
 */
export function getStringDisplayLength(text: string): number {
  let length = 0;
  for (const char of text) {
    // Chinese characters count as 2 display units
    if (/[\u4e00-\u9fff]/.test(char)) {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
}

/**
 * Sanitize keywords for use in file/folder names (Unicode-aware)
 */
export function sanitizeKeywords(keywords: string): string {
  const sanitized = keywords
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Remove special chars except Unicode letters, numbers, spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_') // Replace hyphens with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Limit by display length (accounting for Chinese characters being wider)
  const maxDisplayLength = 50;
  let currentDisplayLength = 0;
  let result = '';
  
  for (const char of sanitized) {
    const charDisplayLength = /[\u4e00-\u9fff]/.test(char) ? 2 : 1;
    if (currentDisplayLength + charDisplayLength <= maxDisplayLength) {
      result += char;
      currentDisplayLength += charDisplayLength;
    } else {
      break;
    }
  }
  
  return result;
}

/**
 * Count meaningful words in issue name (excluding common words)
 */
function countMeaningfulWords(issueName: string): number {
  const commonWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
    'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'create', 'add', 'implement',
    'make', 'build', 'develop', 'setup', 'set', 'up', 'new', 'fix', 'update', 'modify', 'change'
  ]);

  // Chinese common words
  const chineseCommonWords = new Set([
    '的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '从', '到', '为', '以', '对', '将',
    '创建', '添加', '实现', '制作', '构建', '开发', '设置', '新的', '修复', '更新', '修改', '改变'
  ]);

  // If text contains Chinese, handle it differently
  if (isChineseText(issueName)) {
    // For Chinese text, count individual meaningful characters/words
    const chineseWords = issueName
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep Unicode letters and numbers
      .split(/\s+/)
      .filter(word => {
        if (word.length === 0) return false;
        // For Chinese words, check against Chinese common words
        if (/[\u4e00-\u9fff]/.test(word)) {
          return !chineseCommonWords.has(word) && word.length >= 1;
        }
        // For English words, use existing logic
        return word.length > 2 && !commonWords.has(word.toLowerCase());
      });
    return chineseWords.length;
  }

  // For non-Chinese text, use original logic
  const words = issueName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace non-alphanumeric with spaces (Unicode-aware)
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word));

  return words.length;
}

/**
 * Generate issue name keywords using LLM for long names, direct processing for short names
 */
export async function generateIssueNameKeywords(
  issueName: string,
  useGlobal: boolean = true
): Promise<string> {
  if (!issueName || issueName.trim().length === 0) {
    throw new Error('Issue name cannot be empty');
  }

  // Count meaningful words to decide if LLM is needed
  const meaningfulWords = countMeaningfulWords(issueName);
  
  // For short names (1-3 meaningful words), use direct processing
  if (meaningfulWords <= 3) {
    return generateFallbackKeywords(issueName);
  }

  // For long names (4+ meaningful words), use LLM to shorten
  try {
    const config = await loadLLMConfig(useGlobal);
    
    if (!config.apiKey) {
      throw new Error('LLM API key not configured. Run "ppp config set llm_api_key <key>" first.');
    }

    const client = createLLMClient(config);

    const prompt = `Shorten this long issue name to 2-4 key technical keywords for file/folder naming.

Requirements:
- Extract the most important technical/functional concepts
- Use lowercase words only
- Separate with spaces (will be converted to underscores)
- Keep total length under 40 characters
- Preserve core meaning while reducing length
- Avoid redundant words like "create", "add", "implement", "system" unless essential

Long issue name: "${issueName}"

Shortened keywords:`;

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
 * Fallback keyword generation using simple text processing (Unicode-aware)
 */
export function generateFallbackKeywords(issueName: string): string {
  const commonWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
    'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'create', 'add', 'implement',
    'make', 'build', 'develop', 'setup', 'set', 'up', 'new', 'fix', 'update', 'modify', 'change'
  ]);

  // Chinese common words
  const chineseCommonWords = new Set([
    '的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '从', '到', '为', '以', '对', '将',
    '创建', '添加', '实现', '制作', '构建', '开发', '设置', '新的', '修复', '更新', '修改', '改变'
  ]);

  let words: string[];

  if (isChineseText(issueName)) {
    // For Chinese text, preserve meaningful characters and words
    words = issueName
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep Unicode letters and numbers
      .split(/\s+/)
      .filter(word => {
        if (word.length === 0) return false;
        // For Chinese words, check against Chinese common words
        if (/[\u4e00-\u9fff]/.test(word)) {
          return !chineseCommonWords.has(word) && word.length >= 1;
        }
        // For English words mixed in, use existing logic
        return word.length > 2 && !commonWords.has(word.toLowerCase());
      });
  } else {
    // For non-Chinese text, use Unicode-aware processing
    words = issueName
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace non-alphanumeric with spaces (Unicode-aware)
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));
  }

  // For short names, keep all meaningful words (don't limit to 4)
  // For long names, limit to 4 words
  const meaningfulWords = words.length;
  const finalWords = meaningfulWords <= 3 ? words : words.slice(0, 4);

  const keywords = finalWords.join(' ');
  return sanitizeKeywords(keywords);
}

/**
 * Truncate text to fit within a display width, accounting for Chinese characters
 */
export function truncateText(text: string, maxDisplayWidth: number): string {
  if (!text) return '';
  
  const currentDisplayLength = getStringDisplayLength(text);
  if (currentDisplayLength <= maxDisplayWidth) {
    return text;
  }
  
  // Need to truncate - account for "..." which takes 3 display units
  const targetWidth = maxDisplayWidth - 3;
  let result = '';
  let currentWidth = 0;
  
  for (const char of text) {
    const charWidth = /[\u4e00-\u9fff]/.test(char) ? 2 : 1;
    if (currentWidth + charWidth <= targetWidth) {
      result += char;
      currentWidth += charWidth;
    } else {
      break;
    }
  }
  
  return result + '...';
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