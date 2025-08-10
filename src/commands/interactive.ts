/**
 * Interactive UI command for PPP
 * Provides a modern terminal-based interface for managing issues and sprints
 */

import { Command } from 'commander';
import { SimpleUI } from '../ui/simple-ui.js';

export function createInteractiveCommand(): Command {
  const interactiveCommand = new Command('ui');
  interactiveCommand
    .alias('interactive')
    .description('Launch interactive UI mode for managing issues and sprints')
    .option('-f, --fullscreen', 'Force fullscreen mode', true)
    .option('--no-color', 'Disable colors in output')
    .action(async (options) => {
      try {
        console.log('🚀 Starting PPP Interactive Mode...\n');
        
        // Check if we're in a PPP project
        try {
          const { existsSync } = await import('fs');
          const { resolve } = await import('path');
          
          if (!existsSync(resolve('.ppp'))) {
            console.log('❌ PPP not initialized in this directory.');
            console.log('   Run "ppp init" first to initialize a PPP project.');
            process.exit(1);
          }
        } catch (error) {
          console.log('❌ Error checking project status:', error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
        
        console.log('✓ PPP project detected');
        console.log('✓ Loading project data...');
        
        // Test basic data loading
        try {
          const { hybridManager } = await import('../utils/hybrid-manager.js');
          const issues = await hybridManager.listIssues({});
          console.log(`✓ Loaded ${issues.length} issues`);
        } catch (error) {
          console.log('⚠️  Warning: Could not load project data');
          console.log('   This might indicate a data issue, but we\'ll continue');
        }
        
        console.log('✓ Initializing terminal interface...');
        console.log('✓ Ready to start!\n');
        
        console.log('Note: This is a preview version of the interactive UI.');
        console.log('Main features: Basic navigation, issue browsing, search');
        console.log('Press any key to continue or Ctrl+C to cancel...');
        
        // Wait for user to press a key
        await waitForKey();
        
        // Start the simple interactive UI directly
        const ui = new SimpleUI();
        await ui.start();
        
      } catch (error) {
        console.error('\n❌ Failed to start interactive mode:', error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof Error) {
          console.log('\n🐛 Debug information:');
          console.log('Error message:', error.message);
          if (error.stack) {
            console.log('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
          }
          
          if (error.message.includes('terminal') || error.message.includes('TTY')) {
            console.log('\n💡 Terminal-specific troubleshooting:');
            console.log('   • Make sure you\'re running in a proper terminal (not VS Code integrated terminal)');
            console.log('   • Try running with: TERM=xterm-256color ppp ui');
            console.log('   • Check if your terminal supports full-screen applications');
            console.log('   • Ensure terminal is not in a restricted mode');
          }
        }
        
        process.exit(1);
      }
    });

  // Add sub-commands for specific UI views
  interactiveCommand
    .command('issues')
    .description('Go directly to issue management')
    .action(async () => {
      try {
        console.log('🚀 Starting Issue Management...\n');
        const ui = new SimpleUI();
        // Set initial view to issues
        ui.setInitialView('issues');
        await ui.start();
      } catch (error) {
        console.error('Failed to start issue management:', error);
        process.exit(1);
      }
    });

  interactiveCommand
    .command('sprints')
    .description('Go directly to sprint management')
    .action(async () => {
      try {
        console.log('🚀 Starting Sprint Management...\n');
        const ui = new SimpleUI();
        // Set initial view to sprints  
        ui.setInitialView('sprints');
        await ui.start();
      } catch (error) {
        console.error('Failed to start sprint management:', error);
        process.exit(1);
      }
    });

  return interactiveCommand;
}

/**
 * Wait for user to press any key
 */
function waitForKey(): Promise<void> {
  return new Promise((resolve) => {
    // Check if setRawMode is available (not available in some environments)
    if (typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    } else {
      // Fallback for environments without setRawMode
      console.log('Press Enter to continue...');
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    }
  });
}