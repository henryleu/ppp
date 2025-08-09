import { Command } from 'commander';
import Table from 'cli-table3';
import { IssueType, IssuePriority, IssueStatus } from '../types/issue.js';
import { hybridManager } from '../utils/hybrid-manager.js';
import { truncateText } from '../utils/llm.js';
import { normalizeObjectId } from '../utils/object-id-normalizer.js';

// Color utility functions for enhanced UI
function getStatusColor(status: IssueStatus): string {
  switch (status) {
    case IssueStatus.NEW:
      return '\x1b[36m'; // Cyan
    case IssueStatus.IN_PROGRESS:
      return '\x1b[33m'; // Yellow
    case IssueStatus.DONE:
      return '\x1b[32m'; // Green
    case IssueStatus.BLOCKED:
      return '\x1b[31m'; // Red
    case IssueStatus.CANCELLED:
      return '\x1b[90m'; // Gray
    default:
      return '\x1b[0m'; // Reset
  }
}

function getPriorityColor(priority: IssuePriority): string {
  switch (priority) {
    case IssuePriority.HIGH:
      return '\x1b[91m'; // Bright Red
    case IssuePriority.MEDIUM:
      return '\x1b[93m'; // Bright Yellow
    case IssuePriority.LOW:
      return '\x1b[92m'; // Bright Green
    default:
      return '\x1b[0m'; // Reset
  }
}

function getTypeColor(type: IssueType): string {
  switch (type) {
    case IssueType.FEATURE:
      return '\x1b[94m'; // Bright Blue
    case IssueType.STORY:
      return '\x1b[96m'; // Bright Cyan
    case IssueType.TASK:
      return '\x1b[37m'; // White
    case IssueType.BUG:
      return '\x1b[95m'; // Bright Magenta
    default:
      return '\x1b[0m'; // Reset
  }
}

function getTypeIcon(type: IssueType): string {
  switch (type) {
    case IssueType.FEATURE:
      return '🎯';
    case IssueType.STORY:
      return '📖';
    case IssueType.TASK:
      return '✅';
    case IssueType.BUG:
      return '🐛';
    default:
      return '📋';
  }
}

export function createIssueCommand(): Command {
  const issueCommand = new Command('issue');
  issueCommand.description('Manage issues (features, stories, tasks, bugs)');

  // ppp issue create
  issueCommand
    .command('create')
    .description('Create a new issue')
    .argument('<type>', 'Issue type (feature, story, task, bug)')
    .argument('[parent_id]', 'Parent issue ID (optional for top-level features)')
    .argument('[name]', 'Issue name')
    .option('-d, --description <description>', 'Issue description')
    .option('-p, --priority <priority>', 'Issue priority (high, medium, low)', 'medium')
    .option('-a, --assignee <assignee>', 'Issue assignee')
    .option('-r, --reporter <reporter>', 'Issue reporter')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .action(async (type, parentId, name, options) => {
      try {
        // Validate issue type
        if (!Object.values(IssueType).includes(type as IssueType)) {
          console.error(`[ERROR] Invalid issue type: ${type}`);
          console.error(`Valid types: ${Object.values(IssueType).join(', ')}`);
          process.exit(1);
        }

        // Validate priority
        const priority = options.priority.toLowerCase();
        if (!['high', 'medium', 'low'].includes(priority)) {
          console.error(`[ERROR] Invalid priority: ${options.priority}`);
          console.error('Valid priorities: high, medium, low');
          process.exit(1);
        }

        // Handle the case where no parent_id is provided for modules
        // If name is undefined, parentId actually contains the name
        let actualParentId = parentId;
        let actualName = name;

        if (!name && parentId) {
          // This means parentId is actually the name (no parent provided)
          actualName = parentId;
          actualParentId = undefined;
        }

        // For now, require name parameter (interactive mode to be implemented later)
        if (!actualName) {
          console.error('[ERROR] Issue name is required');
          console.error('Usage: ppp issue create <type> [parent_id] <name>');
          console.error('For modules without parent: ppp issue create module "Module Name"');
          process.exit(1);
        }

        // Create issue
        const issueData = {
          type: type as IssueType,
          name: actualName,
          description: options.description,
          priority: priority === 'high' ? IssuePriority.HIGH :
                   priority === 'low' ? IssuePriority.LOW : IssuePriority.MEDIUM,
          assignee: options.assignee,
          reporter: options.reporter,
          labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [],
          parentId: normalizeObjectId(actualParentId)
        };

        const issue = await hybridManager.createIssue(issueData);

        console.log(`[OK] Issue created successfully!`);
        console.log(`ID: ${issue.id}`);
        console.log(`Name: ${issue.name}`);
        console.log(`Keywords: ${issue.keywords}`);
        console.log(`Folder: ${issue.folderPath}`);

        if (actualParentId) {
          console.log(`Parent: ${actualParentId}`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // ppp issue update
  issueCommand
    .command('update')
    .description('Update an existing issue')
    .argument('<issue_id>', 'Issue ID to update')
    .argument('[name]', 'New issue name')
    .option('-d, --description <description>', 'Issue description')
    .option('-s, --status <status>', 'Issue status (new, in_progress, done, blocked, cancelled)')
    .option('-p, --priority <priority>', 'Issue priority (high, medium, low)')
    .option('-a, --assignee <assignee>', 'Issue assignee')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .action(async (issueId, name, options) => {
      try {
        const updateData: any = {};

        if (name) {
          updateData.name = name;
        }

        if (options.description !== undefined) {
          updateData.description = options.description;
        }

        if (options.status) {
          const statusMap: Record<string, IssueStatus> = {
            'new': IssueStatus.NEW,
            'in_progress': IssueStatus.IN_PROGRESS,
            'done': IssueStatus.DONE,
            'blocked': IssueStatus.BLOCKED,
            'cancelled': IssueStatus.CANCELLED
          };

          const status = statusMap[options.status.toLowerCase()];
          if (!status) {
            console.error(`[ERROR] Invalid status: ${options.status}`);
            console.error('Valid statuses: new, in_progress, done, blocked, cancelled');
            process.exit(1);
          }
          updateData.status = status;
        }

        if (options.priority) {
          const priority = options.priority.toLowerCase();
          if (!['high', 'medium', 'low'].includes(priority)) {
            console.error(`[ERROR] Invalid priority: ${options.priority}`);
            console.error('Valid priorities: high, medium, low');
            process.exit(1);
          }
          updateData.priority = priority === 'high' ? IssuePriority.HIGH :
                              priority === 'low' ? IssuePriority.LOW : IssuePriority.MEDIUM;
        }

        if (options.assignee !== undefined) {
          updateData.assignee = options.assignee;
        }

        if (options.labels) {
          updateData.labels = options.labels.split(',').map((l: string) => l.trim());
        }

        const updatedIssue = await hybridManager.updateIssue(issueId, updateData);

        console.log(`[OK] Issue updated successfully!`);
        console.log(`ID: ${updatedIssue.id}`);
        console.log(`Name: ${updatedIssue.name}`);
        console.log(`Keywords: ${updatedIssue.keywords}`);
        console.log(`Status: ${updatedIssue.status}`);
        console.log(`Priority: ${updatedIssue.priority}`);

        // Show folder path if name was updated (indicates potential folder change)
        if (name && updatedIssue.folderPath) {
          console.log(`Folder: ${updatedIssue.folderPath}`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // ppp issue delete
  issueCommand
    .command('delete')
    .description('Delete an issue (moves to archive)')
    .argument('<issue_id>', 'Issue ID to delete')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (issueId, options) => {
      try {
        if (!options.force) {
          console.log(`[WARNING] This will move issue ${issueId} to archive.`);
          console.log('Use --force to confirm deletion.');
          process.exit(1);
        }

        await hybridManager.deleteIssue(issueId);

        console.log(`[OK] Issue ${issueId} deleted successfully (moved to archive)`);
      } catch (error) {
        console.error(`[ERROR] Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // ppp issue list
  issueCommand
    .command('list [issue_id]')
    .description('List issues in various formats: top-level, hierarchical tree, or parent-filtered')
    .option('-p, --parent <parent_id>', 'Filter by parent issue ID')
    .option('-t, --type <type>', 'Filter by issue type (feature, story, task, bug)')
    .option('-s, --status <status>', 'Filter by issue status (new, in_progress, done, blocked, cancelled)')
    .option('-a, --assignee <assignee>', 'Filter by assignee name')
    .option('-l, --labels <labels>', 'Filter by labels (comma-separated)')
    .option('--sprint <sprint_id>', 'Filter by sprint ID')
    .action(async (issueId, options) => {
      try {
        let parentIssue = null;
        let effectiveParentId = options.parent;
        let issues: any[];

        // If issueId is provided, validate it exists and show hierarchical view of descendants
        if (issueId) {
          parentIssue = await hybridManager.getIssue(issueId);
          if (!parentIssue) {
            console.error(`[ERROR] Issue ${issueId} not found`);
            process.exit(1);
          }

          // Use hierarchical listing to show all descendants in proper order
          issues = await hybridManager.listIssuesHierarchical(issueId, {
            type: options.type as IssueType,
            status: options.status,
            assignee: options.assignee,
            labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : undefined,
            sprintId: options.sprint
          });
        } else {
          // No issueId provided - show only top-level issues (no parent)
          effectiveParentId = options.parent || null;

          issues = await hybridManager.listIssues({
            parentId: effectiveParentId,
            type: options.type as IssueType,
            status: options.status,
            assignee: options.assignee,
            labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : undefined,
            sprintId: options.sprint
          });
        }

        // Enhanced empty state messages with emojis
        if (issues.length === 0) {
          if (parentIssue) {
            console.log(`\n${getTypeIcon(parentIssue.type)} Hierarchical view under ${parentIssue.id}: ${parentIssue.name}`);
            console.log('═'.repeat(65));
            console.log('\n💭 No descendant issues found under this parent.');
            console.log('   Create child issues with: ppp issue create <type> <parent_id> "<name>"');
          } else if (effectiveParentId) {
            console.log(`\n👥 Issues with parent ${effectiveParentId}:`);
            console.log('═'.repeat(45));
            console.log('\n💭 No issues found with this parent.');
            console.log('   Create child issues with: ppp issue create <type> <parent_id> "<name>"');
          } else {
            console.log('\n🏗️  Top-level issues:');
            console.log('═'.repeat(25));
            console.log('\n💭 No issues found. Create one with: ppp issue create <type> "<name>"');
          }
          return;
        }

        // Enhanced header with emojis and better formatting
        if (parentIssue) {
          // Hierarchical view of descendants under specific parent
          console.log(`\n${getTypeIcon(parentIssue.type)} Hierarchical view under ${parentIssue.id}: ${parentIssue.name}`);
          const statusColor = getStatusColor(parentIssue.status);
          const priorityColor = getPriorityColor(parentIssue.priority);
          console.log(`   ${getTypeColor(parentIssue.type)}${parentIssue.type}\x1b[0m | ${statusColor}${parentIssue.status}\x1b[0m | ${priorityColor}${parentIssue.priority}\x1b[0m`);
          console.log('═'.repeat(65));
        } else if (effectiveParentId) {
          // Flat view filtered by parent
          console.log(`\n👥 Issues with parent ${effectiveParentId}:`);
          console.log('═'.repeat(45));
        } else {
          // Top-level issues (no parent)
          console.log(`\n🏗️  Top-level issues:`);
          console.log('═'.repeat(25));
        }

        const table = new Table({
          head: ['ID', 'Name', 'Type', 'Status', 'Priority', 'Assignee', 'Parent'],
          colWidths: [12, 35, 10, 14, 12, 15, 12],
          style: {
            'padding-left': 1,
            'padding-right': 1,
            head: [],
            border: []
          },
          chars: {
            'top': '─',
            'top-mid': '┬',
            'top-left': '┌',
            'top-right': '┐',
            'bottom': '─',
            'bottom-mid': '┴',
            'bottom-left': '└',
            'bottom-right': '┘',
            'left': '│',
            'left-mid': '├',
            'mid': '─',
            'mid-mid': '┼',
            'right': '│',
            'right-mid': '┤',
            'middle': '│'
          }
        });

        issues.forEach(issue => {
          const statusColor = getStatusColor(issue.status);
          const priorityColor = getPriorityColor(issue.priority);
          const typeColor = getTypeColor(issue.type);

          table.push([
            issue.id,
            truncateText(issue.name, 35),
            typeColor + issue.type + '\x1b[0m',
            statusColor + issue.status + '\x1b[0m',
            priorityColor + issue.priority + '\x1b[0m',
            issue.assignee || '-',
            issue.parentId || '-'
          ]);
        });

        console.log('\n' + table.toString());

        // Enhanced summary messages with icons
        if (parentIssue) {
          console.log(`\n📊 Total: ${issues.length} issues in hierarchy under ${parentIssue.id}`);
        } else if (effectiveParentId) {
          console.log(`\n📊 Total: ${issues.length} issues with parent ${effectiveParentId}`);
        } else {
          console.log(`\n📊 Total: ${issues.length} top-level issues`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to list issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  return issueCommand;
}
