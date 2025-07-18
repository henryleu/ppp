import { Command } from 'commander';
import { generateIssueNameKeywords, generateFallbackKeywords } from '../utils/llm.js';

export function createKeywordsCommand(): Command {
  const keywordsCommand = new Command('keywords');
  keywordsCommand.description('Generate keywords from issue names');

  keywordsCommand
    .command('generate')
    .description('Generate keywords from issue name using LLM')
    .argument('<issue_name>', 'The full issue name to generate keywords from')
    .option('--fallback', 'Use fallback generation instead of LLM')
    .option('-g, --global', 'Use global configuration (~/.ppp/settings.json)')
    .action(async (issueName, options) => {
      try {
        let keywords: string;
        
        if (options.fallback) {
          keywords = generateFallbackKeywords(issueName);
          console.log(`[Fallback] Generated keywords: "${keywords}"`);
        } else {
          const useGlobal = options.global || false;
          keywords = await generateIssueNameKeywords(issueName, useGlobal);
          console.log(`[LLM] Generated keywords: "${keywords}"`);
        }
        
        console.log(`Length: ${keywords.length} characters`);
        console.log(`Usage example: F01-${keywords}/spec.md`);
      } catch (error) {
        console.error(`[ERROR] Failed to generate keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  keywordsCommand
    .command('test')
    .description('Test keyword generation with sample data')
    .option('--fallback-only', 'Test only fallback generation')
    .action(async (options) => {
      const testCases = [
        'Create user authentication system',
        'Fix bug in payment processing module',
        'Admin dashboard for user management'
      ];

      console.log('\n=== Testing Keyword Generation ===\n');

      for (const testCase of testCases) {
        try {
          console.log(`Issue: "${testCase}"`);
          
          if (options.fallbackOnly) {
            const keywords = generateFallbackKeywords(testCase);
            console.log(`Fallback: "${keywords}"`);
          } else {
            const keywords = await generateIssueNameKeywords(testCase);
            console.log(`LLM: "${keywords}"`);
          }
          
          console.log('---');
        } catch (error) {
          console.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('---');
        }
      }
    });

  return keywordsCommand;
}