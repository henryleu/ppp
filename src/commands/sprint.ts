import { Command } from 'commander';
import prompts from 'prompts';
import Table from 'cli-table3';
import { hybridManager } from '../utils/hybrid-manager.js';
import { SprintState } from '../types/sprint.js';

export function createSprintCommand(): Command {
  const sprint = new Command('sprint');
  sprint.description('Manage sprints - create, activate, delete and track sprint progress');

  // Sprint create command
  sprint
    .command('create')
    .description('Create a new sprint')
    .argument('[description]', 'Sprint description')
    .action(async (description?: string) => {
      try {
        let sprintDescription = description;
        
        if (!sprintDescription) {
          const response = await prompts({
            type: 'text',
            name: 'description',
            message: 'Enter sprint description:',
            validate: value => value.trim().length > 0 || 'Description is required'
          });
          
          if (!response.description) {
            console.log('Sprint creation cancelled.');
            return;
          }
          
          sprintDescription = response.description;
        }
        
        const sprint = await hybridManager.createSprint({
          description: sprintDescription
        });
        
        console.log(`\n✓ Sprint created successfully!\n`);
        console.log(`Sprint: ${sprint.name}`);
        console.log(`Description: ${sprint.description}`);
        console.log(`Status: ${sprint.state}`);
        console.log(`Start Date: ${new Date(sprint.startDate).toLocaleDateString()}`);
        console.log(`File: .ppp/${sprint.id}.md`);
        
      } catch (error) {
        console.error('Failed to create sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint activate command  
  sprint
    .command('activate')
    .description('Activate a sprint (deactivates any currently active sprint)')
    .argument('<sprint_no>', 'Sprint number to activate (e.g., 01, 02)')
    .action(async (sprintNo: string) => {
      try {
        const success = await hybridManager.activateSprint(sprintNo);
        
        if (!success) {
          console.error(`Sprint ${sprintNo} not found.`);
          process.exit(1);
        }
        
        console.log(`\n✓ Sprint ${sprintNo} activated successfully!\n`);
        console.log('All previously active sprints have been moved to completed status.');
        console.log('All issues in this sprint have been set to "In Progress" status.');
        
      } catch (error) {
        console.error('Failed to activate sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint delete command
  sprint
    .command('delete')
    .description('Delete a sprint and remove it from all references')
    .argument('<sprint_no>', 'Sprint number to delete (e.g., 01, 02)')
    .action(async (sprintNo: string) => {
      try {
        // Confirm deletion
        const response = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to delete Sprint ${sprintNo}? This will remove sprint assignments from all issues and archive the sprint file.`,
          initial: false
        });
        
        if (!response.confirmed) {
          console.log('Sprint deletion cancelled.');
          return;
        }
        
        const success = await hybridManager.deleteSprint(sprintNo);
        
        if (!success) {
          console.error(`Sprint ${sprintNo} not found.`);
          process.exit(1);
        }
        
        console.log(`\n✓ Sprint ${sprintNo} deleted successfully!\n`);
        console.log('Sprint file has been moved to .ppp/_archived/');
        console.log('Sprint assignments have been removed from all issues.');
        console.log('Release.md has been updated.');
        
      } catch (error) {
        console.error('Failed to delete sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint complete command
  sprint
    .command('complete')
    .description('Complete an active sprint')
    .argument('<sprint_no>', 'Sprint number to complete (e.g., 01, 02)')
    .action(async (sprintNo: string) => {
      try {
        const success = await hybridManager.completeSprint(sprintNo);
        
        if (!success) {
          console.error(`Sprint ${sprintNo} not found.`);
          process.exit(1);
        }
        
        console.log(`\n✓ Sprint ${sprintNo} completed successfully!\n`);
        console.log('Sprint velocity has been calculated based on completed issues.');
        console.log('Release.md has been updated.');
        
      } catch (error) {
        console.error('Failed to complete sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint list command
  sprint
    .command('list')
    .description('List all sprints with their status')
    .action(async () => {
      try {
        const sprints = await hybridManager.getSprints();
        
        if (sprints.length === 0) {
          console.log('No sprints found. Create one with "ppp sprint create".');
          return;
        }
        
        const table = new Table({
          head: ['Sprint', 'Status', 'Start Date', 'End Date', 'Issues', 'Velocity'],
          colWidths: [12, 12, 12, 12, 8, 10]
        });
        
        for (const sprint of sprints) {
          const statusColor = getStatusColor(sprint.state);
          table.push([
            sprint.name,
            statusColor + sprint.state + '\x1b[0m',
            new Date(sprint.startDate).toLocaleDateString(),
            sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : '-',
            sprint.issues.length.toString(),
            sprint.velocity.toString()
          ]);
        }
        
        console.log('\n' + table.toString());
        
        // Show active sprint separately
        const activeSprint = await hybridManager.getActiveSprint();
        if (activeSprint) {
          console.log(`\n🚀 Active Sprint: ${activeSprint.name}`);
          console.log(`   Description: ${activeSprint.description}`);
          console.log(`   Issues: ${activeSprint.issues.length}`);
        } else {
          console.log(`\n💡 No active sprint. Use "ppp sprint activate <sprint_no>" to activate one.`);
        }
        
      } catch (error) {
        console.error('Failed to list sprints:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint add command (add issue to sprint)
  sprint
    .command('add')
    .description('Add an issue to a sprint')
    .argument('<issue_id>', 'Issue ID to add to sprint')
    .argument('<sprint_no>', 'Sprint number (e.g., 01, 02)')
    .action(async (issueId: string, sprintNo: string) => {
      try {
        const success = await hybridManager.addIssueToSprint(issueId, sprintNo);
        
        if (!success) {
          console.error(`Sprint ${sprintNo} not found.`);
          process.exit(1);
        }
        
        console.log(`\n✓ Issue ${issueId} added to Sprint ${sprintNo} successfully!\n`);
        console.log('Issue sprint assignment has been updated.');
        console.log('Sprint file has been updated.');
        
      } catch (error) {
        console.error('Failed to add issue to sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint remove command (remove issue from sprint)
  sprint
    .command('remove')
    .description('Remove an issue from a sprint')
    .argument('<issue_id>', 'Issue ID to remove from sprint')
    .argument('<sprint_no>', 'Sprint number (e.g., 01, 02)')
    .action(async (issueId: string, sprintNo: string) => {
      try {
        const success = await hybridManager.removeIssueFromSprint(issueId, sprintNo);
        
        if (!success) {
          console.error(`Sprint ${sprintNo} not found.`);
          process.exit(1);
        }
        
        console.log(`\n✓ Issue ${issueId} removed from Sprint ${sprintNo} successfully!\n`);
        console.log('Issue sprint assignment has been cleared.');
        console.log('Sprint file has been updated.');
        
      } catch (error) {
        console.error('Failed to remove issue from sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return sprint;
}

function getStatusColor(status: SprintState): string {
  switch (status) {
    case SprintState.PLANNED:
      return '\x1b[36m'; // Cyan
    case SprintState.ACTIVE:
      return '\x1b[32m'; // Green
    case SprintState.COMPLETED:
      return '\x1b[33m'; // Yellow
    case SprintState.ARCHIVED:
      return '\x1b[90m'; // Gray
    default:
      return '\x1b[0m'; // Reset
  }
}