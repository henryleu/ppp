import { Command } from 'commander';
import prompts from 'prompts';
import Table from 'cli-table3';
import { sprintManager } from '../utils/sprint.js';
import { hybridManager } from '../utils/hybrid-manager.js';
import { SprintStatus } from '../types/sprint.js';
import { normalizeObjectId } from '../utils/object-id-normalizer.js';
import {
  displaySuccessHeader,
  displayWarningHeader,
  displayErrorHeader,
  displayInfoTable,
  displayNextSteps,
  displaySimpleSuccess,
  displaySimpleWarning,
  displaySimpleError,
  displaySummary,
  getStatusIcon,
  actionIcons,
  formatPath,
  getColoredStatus
} from '../utils/ui-helpers.js';

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

        // Enhanced UI display
        displaySuccessHeader('Sprint Creation Successful!', actionIcons.sprint);

        const tableData = [
          { label: 'Sprint ID', value: sprint.id, icon: actionIcons.id },
          { label: 'Name', value: sprint.name, icon: actionIcons.name },
          { label: 'Status', value: `${getStatusIcon(sprint.status)} ${getColoredStatus(sprint.status)}`, icon: actionIcons.status },
          { label: 'Start Date', value: new Date(sprint.startDate).toLocaleDateString(), icon: actionIcons.date },
          { label: 'Folder', value: `.ppp/${sprint.id}/`, icon: actionIcons.folder },
          { label: 'Spec File', value: `.ppp/${sprint.id}/spec.md`, icon: '📄' }
        ];

        displayInfoTable(tableData);

        // Next steps
        const nextSteps = [
          `Add issues: ppp sprint add <issue_id> <sprint_no>`,
          `Activate sprint: ppp sprint activate <sprint_no>`,
          `View sprint: ppp sprint list`
        ];
        displayNextSteps('Next Steps', nextSteps);
      } catch (error) {
        displayErrorHeader('Sprint Creation Failed');
        displaySimpleError(`Failed to create sprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const normalizedSprintId = normalizeObjectId(sprintId) || '';
        const success = await sprintManager.activateSprint(normalizedSprintId);

        if (!success) {
          displayErrorHeader('Sprint Activation Failed');
          displaySimpleError(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        displaySuccessHeader('Sprint Activation Successful!', actionIcons.activate);
        
        displaySimpleSuccess(`${actionIcons.sprint} Sprint ${sprintId} is now ACTIVE!`);
        
        const summaryItems = [
          { label: 'Status Change', value: 'Planned → Active' },
          { label: 'Issues Status', value: 'All moved to "In Progress"' },
          { label: 'Previous Active Sprint', value: 'Automatically completed' }
        ];
        displaySummary('Activation Summary', summaryItems);
      } catch (error) {
        displayErrorHeader('Sprint Activation Failed');
        displaySimpleError(`Failed to activate sprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        const normalizedSprintId = normalizeObjectId(sprintId) || '';
        const success = await sprintManager.deleteSprint(normalizedSprintId);

        if (!success) {
          console.error(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        console.log(`\n✓ Sprint ${sprintId} deleted successfully!\n`);
        console.log('Sprint folder has been moved to .ppp/_archived/');
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
        const normalizedSprintId = normalizeObjectId(sprintId) || '';
        const success = await sprintManager.completeSprint(normalizedSprintId);

        if (!success) {
          console.error(`Sprint ${sprintId} not found.`);
          process.exit(1);
        }

        console.log(`\n✓ Sprint ${sprintId} completed successfully!\n`);
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
          head: ['ID', 'Status', 'Start Date', 'End Date', 'Issues', 'Velocity', 'Name'],
          colWidths: [12, 12, 12, 12, 8, 10, 20],
          style: {
            'padding-left': 1,
            'padding-right': 1,
            head: [],
            border: []
          }
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
        const normalizedIssueId = normalizeObjectId(issueId) || '';
        const normalizedSprintId = normalizeObjectId(sprintId) || '';

        await hybridManager.assignIssueToSprint(normalizedIssueId, normalizedSprintId);

        displaySuccessHeader('Issue Added to Sprint!', actionIcons.add);
        
        displaySimpleSuccess(`${actionIcons.sprint} ${normalizedIssueId} → Sprint-${sprintId.padStart(2, '0')}`);
        
        // Get updated sprint info for summary
        const sprint = await hybridManager.getSprint(`Sprint-${sprintId.padStart(2, '0')}`);
        if (sprint) {
          const summaryItems = [
            { label: 'Total Issues in Sprint', value: sprint.issues.length.toString() },
            { label: 'Sprint Status', value: sprint.status },
            { label: 'Symlink Created', value: `.ppp/Sprint-${sprintId.padStart(2, '0')}/` }
          ];
          displaySummary('Sprint Update', summaryItems);
        }
      } catch (error) {
        displayErrorHeader('Failed to Add Issue to Sprint');
        displaySimpleError(`Failed to add issue to sprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const normalizedIssueId = normalizeObjectId(issueId) || '';
        const normalizedSprintId = normalizeObjectId(sprintId) || '';

        await hybridManager.removeIssueFromSprint(normalizedIssueId, normalizedSprintId);

        displaySuccessHeader('Issue Removed from Sprint!', actionIcons.remove);
        
        displaySimpleSuccess(`${actionIcons.sprint} ${normalizedIssueId} removed from Sprint-${sprintId.padStart(2, '0')}`);
        
        // Get updated sprint info for summary
        const sprint = await hybridManager.getSprint(`Sprint-${sprintId.padStart(2, '0')}`);
        if (sprint) {
          const summaryItems = [
            { label: 'Remaining Issues in Sprint', value: sprint.issues.length.toString() },
            { label: 'Sprint Status', value: sprint.status },
            { label: 'Symlink Removed', value: `.ppp/Sprint-${sprintId.padStart(2, '0')}/` }
          ];
          displaySummary('Sprint Update', summaryItems);
        }
      } catch (error) {
        displayErrorHeader('Failed to Remove Issue from Sprint');
        displaySimpleError(`Failed to remove issue from sprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
