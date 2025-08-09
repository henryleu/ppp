import { Command } from 'commander';
import prompts from 'prompts';
import Table from 'cli-table3';
import { sprintManager } from '../utils/sprint.js';
import { hybridManager } from '../utils/hybrid-manager.js';
import { SprintStatus } from '../types/sprint.js';
import { normalizeObjectId } from '../utils/object-id-normalizer.js';

// Sprint ID specific normalization helper
function normalizeSprintId(sprintId: string): string {
  // Handle Sprint IDs: S01 → 01, s01 → 01, 01 → 01
  const cleanNo = sprintId.replace(/^[sS]/i, '');
  return cleanNo.padStart(2, '0');
}

export function createSprintCommand(): Command {
  const sprint = new Command('sprint');
  sprint.description('Manage sprints - create, activate, delete and track sprint progress');

  // Sprint create command
  sprint
    .command('create')
    .description('Create a new sprint')
    .argument('[name]', 'Sprint name')
    .action(async (name?: string) => {
      try {
        let sprintName = name || 'new sprint';

        if (!sprintName) {
          const response = await prompts({
            type: 'text',
            name: 'name',
            message: 'Enter sprint name:',
            validate: value => value.trim().length > 0 || 'Sprint name is required'
          });

          if (!response.name) {
            console.log('Sprint creation cancelled.');
            return;
          }

          sprintName = response.name;
        }

        const sprint = await sprintManager.createSprint({
          name: sprintName
        });

        console.log(`\n✓ Sprint created successfully!\n`);
        console.log(`Sprint: ${sprint.name}`);
        console.log(`ID: ${sprint.id}`);
        console.log(`Status: ${sprint.status}`);
        console.log(`Start Date: ${new Date(sprint.startDate).toLocaleDateString()}`);
        console.log(`Folder: .ppp/${sprint.id}/`);
        console.log(`Spec File: .ppp/${sprint.id}/spec.md`);

      } catch (error) {
        console.error('Failed to create sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Sprint activate command
  sprint
    .command('activate')
    .description('Activate a sprint (deactivates any currently active sprint)')
    .argument('<sprint_id>', 'Sprint ID to activate (e.g., S01, S02, or 01, 02)')
    .action(async (sprintId: string) => {
      try {
        const normalizedSprintNo = normalizeSprintId(sprintId);
        const success = await sprintManager.activateSprint(normalizedSprintNo);

        if (!success) {
          console.error(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        console.log(`\n✓ Sprint ${sprintId} activated successfully!\n`);
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
    .argument('<sprint_id>', 'Sprint ID to delete (e.g., S01, S02, or 01, 02)')
    .action(async (sprintId: string) => {
      try {
        // Confirm deletion
        const response = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to delete Sprint ${sprintId}? This will remove sprint assignments from all issues and archive the sprint file.`,
          initial: false
        });

        if (!response.confirmed) {
          console.log('Sprint deletion cancelled.');
          return;
        }

        const normalizedSprintNo = normalizeSprintId(sprintId);
        const success = await sprintManager.deleteSprint(normalizedSprintNo);

        if (!success) {
          console.error(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        console.log(`\n✓ Sprint ${sprintId} deleted successfully!\n`);
        console.log('Sprint folder has been moved to .ppp/_archived/');
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
    .argument('<sprint_id>', 'Sprint ID to complete (e.g., S01, S02, or 01, 02)')
    .action(async (sprintId: string) => {
      try {
        const normalizedSprintNo = normalizeSprintId(sprintId);
        const success = await sprintManager.completeSprint(normalizedSprintNo);

        if (!success) {
          console.error(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        console.log(`\n✓ Sprint ${sprintId} completed successfully!\n`);
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
        const sprints = await hybridManager.getSprintSummaries();

        if (sprints.length === 0) {
          console.log('No sprints found. Create one with "ppp sprint create".');
          return;
        }

        const table = new Table({
          head: ['Sprint ID', 'Status', 'Start Date', 'End Date', 'Issues', 'Velocity', 'Name'],
          colWidths: [12, 12, 12, 12, 8, 10, 20]
        });

        for (const sprint of sprints) {
          const statusColor = getStatusColor(sprint.status);
          table.push([
            sprint.id,
            statusColor + sprint.status + '\x1b[0m',
            new Date(sprint.startDate).toLocaleDateString(),
            sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : '-',
            sprint.issueCount.toString(),
            sprint.velocity.toString(),
            sprint.name
          ]);
        }

        console.log('\n' + table.toString());

        // Show active sprint separately
        const activeSprint = await hybridManager.getActiveSprint();
        if (activeSprint) {
          console.log(`\n🚀 Active Sprint: ${activeSprint.id}`);
          console.log(`  Name: ${activeSprint.name}`);
          console.log(`  Description: ${activeSprint.description}`);
          console.log(`  Issues: ${activeSprint.issues.length}`);
        } else {
          console.log(`\n💡 No active sprint. Use "ppp sprint activate <sprint_id>" to activate one.`);
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
    .argument('<sprint_id>', 'Sprint ID (e.g., S01, S02, or 01, 02)')
    .action(async (issueId: string, sprintId: string) => {
      try {
        const normalizedIssueId = normalizeObjectId(issueId);
        const normalizedSprintNo = normalizeSprintId(sprintId);
        const sprintIdFormatted = `S${normalizedSprintNo}`;
        
        await hybridManager.assignIssueToSprint(normalizedIssueId, sprintIdFormatted);

        console.log(`✓ Issue ${normalizedIssueId} added to Sprint ${sprintId} successfully!`);
        console.log('Issue sprint assignment has been updated in database.');
        console.log('Sprint spec file has been updated.');

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
    .argument('<sprint_id>', 'Sprint ID (e.g., S01, S02, or 01, 02)')
    .action(async (issueId: string, sprintId: string) => {
      try {
        const normalizedIssueId = normalizeObjectId(issueId);
        const normalizedSprintNo = normalizeSprintId(sprintId);
        const sprintIdFormatted = `S${normalizedSprintNo}`;
        
        await hybridManager.removeIssueFromSprint(normalizedIssueId, sprintIdFormatted);

        console.log(`\n✓ Issue ${normalizedIssueId} removed from Sprint ${sprintId} successfully!\n`);
        console.log('Issue sprint assignment has been cleared in database.');
        console.log('Sprint spec file has been updated.');

      } catch (error) {
        console.error('Failed to remove issue from sprint:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return sprint;
}

function getStatusColor(status: SprintStatus): string {
  switch (status) {
    case SprintStatus.PLANNED:
      return '\x1b[36m'; // Cyan
    case SprintStatus.ACTIVE:
      return '\x1b[32m'; // Green
    case SprintStatus.COMPLETED:
      return '\x1b[33m'; // Yellow
    case SprintStatus.ARCHIVED:
      return '\x1b[90m'; // Gray
    default:
      return '\x1b[0m'; // Reset
  }
}
