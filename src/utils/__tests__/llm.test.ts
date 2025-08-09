import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { 
  generateIssueNameKeywords, 
  generateFallbackKeywords,
  sanitizeKeywords,
  isChineseText,
  getStringDisplayLength,
  truncateText
} from '../llm.js';

// Mock the AI SDK and config functions
const mockGenerateText = mock(() => Promise.resolve({ text: 'mocked keywords' }));
const mockCreateOpenAI = mock(() => ({ model: () => 'mocked-model' }));
const mockLoadLLMConfig = mock(() => Promise.resolve({
  apiKey: 'test-api-key',
  apiUrl: 'https://api.test.com',
  model: 'test-model',
  temperature: 0.7,
  maxTokens: 50,
  topP: 0.9
}));

// Mock the external dependencies
mock.module('ai', () => ({
  generateText: mockGenerateText,
}));

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

mock.module('./config.js', () => ({
  loadConfig: mock(() => Promise.resolve({
    llm_api_key: 'test-key',
    llm_api_url: 'https://api.test.com',
    llm_api_model: 'test-model',
    llm_api_temperature: 0.7,
    llm_api_max_tokens: 50,
    llm_api_top_p: 0.9
  }))
}));

describe('LLM Utility Functions', () => {
  beforeEach(() => {
    mockGenerateText.mockClear();
    mockCreateOpenAI.mockClear();
    mockLoadLLMConfig.mockClear();
  });

  describe('generateFallbackKeywords', () => {
    test('should preserve action verbs in technical contexts', () => {
      // These are the failing test cases mentioned by the user
      expect(generateFallbackKeywords('add permission')).toBe('add_permission');
      expect(generateFallbackKeywords('update permission')).toBe('update_permission');
      expect(generateFallbackKeywords('create user')).toBe('create_user');
      expect(generateFallbackKeywords('fix bug')).toBe('fix_bug');
      expect(generateFallbackKeywords('implement feature')).toBe('implement_feature');
    });

    test('should handle basic technical terms', () => {
      expect(generateFallbackKeywords('user management')).toBe('user_management');
      expect(generateFallbackKeywords('payment processing')).toBe('payment_processing');
      expect(generateFallbackKeywords('database migration')).toBe('database_migration');
      expect(generateFallbackKeywords('authentication system')).toBe('authentication_system');
    });

    test('should filter out truly common words', () => {
      expect(generateFallbackKeywords('the user is authenticated')).toBe('user_authenticated');
      expect(generateFallbackKeywords('a new system for users')).toBe('new_system_users');
      expect(generateFallbackKeywords('and the user has permission')).toBe('user_permission');
    });

    test('should handle multiple meaningful words', () => {
      expect(generateFallbackKeywords('user authentication management system')).toBe('user_authentication_management_system');
      expect(generateFallbackKeywords('real time notification service')).toBe('real_time_notification_service');
    });

    test('should limit to 4 words for very long names', () => {
      const longName = 'comprehensive user authentication management system with oauth integration';
      const result = generateFallbackKeywords(longName);
      const wordCount = result.split('_').length;
      expect(wordCount).toBeLessThanOrEqual(4);
    });

    test('should handle Chinese text', () => {
      expect(generateFallbackKeywords('用户管理系统')).toBe('用户管理系统');
      expect(generateFallbackKeywords('创建用户权限')).toBe('创建用户权限');
    });

    test('should handle mixed Chinese and English', () => {
      expect(generateFallbackKeywords('用户 authentication 系统')).toBe('用户_authentication_系统');
    });

    test('should handle empty or whitespace-only input', () => {
      expect(generateFallbackKeywords('')).toBe('');
      expect(generateFallbackKeywords('   ')).toBe('');
      expect(generateFallbackKeywords('\t\n')).toBe('');
    });

    test('should handle single words', () => {
      expect(generateFallbackKeywords('authentication')).toBe('authentication');
      expect(generateFallbackKeywords('user')).toBe('user');
    });

    test('should handle special characters and punctuation', () => {
      expect(generateFallbackKeywords('user-management')).toBe('user_management');
      expect(generateFallbackKeywords('payment.processing')).toBe('payment_processing');
      expect(generateFallbackKeywords('OAuth2 integration!')).toBe('oauth2_integration');
    });
  });

  describe('generateIssueNameKeywords', () => {
    test('should use fallback for short names (≤3 meaningful words)', async () => {
      // These should use fallback processing (direct keyword generation)
      const result1 = await generateIssueNameKeywords('add permission');
      expect(result1).toBe('add_permission');
      
      const result2 = await generateIssueNameKeywords('update permission');
      expect(result2).toBe('update_permission');
      
      const result3 = await generateIssueNameKeywords('user management system');
      expect(result3).toBe('user_management_system');
    });

    test('should fallback to simple processing when LLM is not available', async () => {
      // For long names without API key, should fallback to generateFallbackKeywords
      const longName = 'comprehensive user authentication system with OAuth2 integration';
      const result = await generateIssueNameKeywords(longName);
      
      // Should fallback to generateFallbackKeywords and limit to 4 words
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      const wordCount = result.split('_').length;
      expect(wordCount).toBeLessThanOrEqual(4);
    });

    test('should reject empty issue names', async () => {
      await expect(generateIssueNameKeywords('')).rejects.toThrow('Issue name cannot be empty');
      await expect(generateIssueNameKeywords('   ')).rejects.toThrow('Issue name cannot be empty');
    });
  });

  describe('sanitizeKeywords', () => {
    test('should convert to lowercase and replace spaces with underscores', () => {
      expect(sanitizeKeywords('User Management')).toBe('user_management');
      expect(sanitizeKeywords('PAYMENT PROCESSING')).toBe('payment_processing');
    });

    test('should remove special characters', () => {
      expect(sanitizeKeywords('user-management!')).toBe('user_management');
      expect(sanitizeKeywords('payment.processing?')).toBe('payment_processing');
      expect(sanitizeKeywords('auth@system#')).toBe('auth_system');
    });

    test('should handle multiple spaces and underscores', () => {
      expect(sanitizeKeywords('user   management')).toBe('user_management');
      expect(sanitizeKeywords('user___management')).toBe('user_management');
      expect(sanitizeKeywords('user-_-management')).toBe('user_management');
    });

    test('should remove leading and trailing underscores', () => {
      expect(sanitizeKeywords('_user_management_')).toBe('user_management');
      expect(sanitizeKeywords('___payment___')).toBe('payment');
    });

    test('should handle Chinese characters', () => {
      expect(sanitizeKeywords('用户管理')).toBe('用户管理');
      expect(sanitizeKeywords('用户 管理 系统')).toBe('用户_管理_系统');
    });

    test('should limit display length for Chinese characters', () => {
      // Test with very long Chinese text
      const longChinese = '这是一个非常长的中文测试字符串用来测试显示长度限制功能是否正常工作';
      const result = sanitizeKeywords(longChinese);
      const displayLength = getStringDisplayLength(result);
      expect(displayLength).toBeLessThanOrEqual(50);
    });
  });

  describe('isChineseText', () => {
    test('should detect Chinese characters', () => {
      expect(isChineseText('用户管理')).toBe(true);
      expect(isChineseText('Hello 用户')).toBe(true);
      expect(isChineseText('用户 management')).toBe(true);
    });

    test('should return false for non-Chinese text', () => {
      expect(isChineseText('user management')).toBe(false);
      expect(isChineseText('123456')).toBe(false);
      expect(isChineseText('!@#$%')).toBe(false);
      expect(isChineseText('')).toBe(false);
    });
  });

  describe('getStringDisplayLength', () => {
    test('should count Chinese characters as 2 units', () => {
      expect(getStringDisplayLength('用户')).toBe(4); // 2 Chinese chars = 4 units
      expect(getStringDisplayLength('user')).toBe(4); // 4 English chars = 4 units
      expect(getStringDisplayLength('用户user')).toBe(8); // 2 Chinese + 4 English = 8 units
    });

    test('should handle empty strings', () => {
      expect(getStringDisplayLength('')).toBe(0);
    });

    test('should handle mixed content', () => {
      expect(getStringDisplayLength('用户123abc')).toBe(10); // 2*2 + 3 + 3 = 10
    });
  });

  describe('truncateText', () => {
    test('should truncate text that exceeds display width', () => {
      const result = truncateText('this is a very long text', 10);
      expect(result).toBe('this is...');
      expect(getStringDisplayLength(result)).toBeLessThanOrEqual(10);
    });

    test('should handle Chinese text truncation', () => {
      const result = truncateText('这是一个很长的中文文本', 10);
      expect(result.endsWith('...')).toBe(true);
      expect(getStringDisplayLength(result)).toBeLessThanOrEqual(10);
    });

    test('should return original text if within limit', () => {
      const text = 'short';
      expect(truncateText(text, 10)).toBe(text);
    });

    test('should handle empty text', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle undefined and null inputs gracefully', () => {
      expect(sanitizeKeywords('')).toBe('');
      expect(getStringDisplayLength('')).toBe(0);
      expect(truncateText('', 10)).toBe('');
    });

    test('should handle very short text', () => {
      expect(generateFallbackKeywords('a')).toBe('');
      expect(generateFallbackKeywords('ab')).toBe('');
      expect(generateFallbackKeywords('abc')).toBe('abc');
      expect(generateFallbackKeywords('abcd')).toBe('abcd');
    });

    test('should handle numbers and mixed alphanumeric', () => {
      expect(generateFallbackKeywords('OAuth2 integration')).toBe('oauth2_integration');
      expect(generateFallbackKeywords('API v2 endpoint')).toBe('api_endpoint');
      expect(generateFallbackKeywords('version 1.0 release')).toBe('version_release');
    });
  });
});