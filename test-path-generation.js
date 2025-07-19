import { FileManager } from './dist/utils/file-manager.js';

// Test the complete path generation
const fileManager = new FileManager();

// Mock issue structure for testing
const mockIssues = [
  {
    id: 'F01',
    keywords: 'user-management',
    parentId: null
  },
  {
    id: 'F0103',
    keywords: 'login-form',
    parentId: null
  },
  {
    id: 'F010203',
    keywords: 'password-validation',
    parentId: null
  }
];

// Test path generation
console.log('Testing complete path generation:');

mockIssues.forEach(issue => {
  const path = fileManager.generateIssueFolderPath(issue);
  console.log(`${issue.id} -> ${path}`);
});

console.log('\nExpected results:');
console.log('F01 -> .ppp/F01-user-management');
console.log('F0103 -> .ppp/F01-folder/F03-login-form');
console.log('F010203 -> .ppp/F01-folder/F02-folder/F03-password-validation');