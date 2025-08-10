import { Command } from 'commander';
import Table from 'cli-table3';
import { IssueType, IssuePriority, IssueStatus } from '../types/issue.js';
import { hybridManager } from '../utils/hybrid-manager.js';
import { truncateText } from '../utils/llm.js';
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
  getTypeIcon,
  getStatusIcon,
  getPriorityIcon,
  getColoredStatus,
  getColoredPriority,
  getColoredType,
  actionIcons,
  formatPath
} from '../utils/ui-helpers.js';

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


// Helper function to detect feature hierarchy level
function getIssueLevel(issueId: string): number | null {
  if (!issueId.startsWith('F')) {
    return null; // Only features have levels
  }
  
  const digits = issueId.slice(1); // Remove 'F' prefix
  if (digits.length % 2 !== 0) {
    return null; // Invalid format
  }
  
  return Math.floor(digits.length / 2); // F01=1, F0101=2, F010101=3
}

// Helper function to check if an issue matches level criteria
function matchesLevelFilter(issue: any, level: number, topLevel: boolean, allIssues: any[]): boolean {
  if (topLevel) {
    // For --top-level flag, only show issues with no parent
    // This is handled by parentId filter, but we can also check level 1 features
    if (issue.id.startsWith('F')) {
      return getIssueLevel(issue.id) === 1;
    }
    return !issue.parentId; // Non-features with no parent
  }
  
  if (level > 0) {
    // For --level option, include all issues up to and including the specified level
    if (issue.id.startsWith('F')) {
      // For features, include if their level <= specified level
      const issueLevel = getIssueLevel(issue.id);
      return issueLevel !== null && issueLevel <= level;
    } else {
      // For non-features (tasks, bugs), include if their root parent feature level <= specified level
      const rootParentLevel = getRootParentLevel(issue, allIssues);
      return rootParentLevel !== null && rootParentLevel <= level;
    }
  }
  
  return true; // No level filter applied
}

// Helper function to get the root parent feature level for non-feature issues
function getRootParentLevel(issue: any, allIssues: any[]): number | null {
  if (!issue.parentId) return null;
  
  // Find the root feature parent by traversing up the hierarchy
  let currentIssue = issue;
  while (currentIssue.parentId) {
    const parent = allIssues.find(i => i.id === currentIssue.parentId);
    if (!parent) break;
    
    if (parent.id.startsWith('F')) {
      // Found a feature parent, get its level
      return getIssueLevel(parent.id);
    }
    currentIssue = parent;
  }
  
  return null;
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

        // Enhanced UI display
        displaySuccessHeader('Issue Creation Successful!', getTypeIcon(issue.type));

        const tableData = [
          { label: 'ID', value: issue.id, icon: actionIcons.id },
          { label: 'Name', value: issue.name, icon: actionIcons.name },
          { label: 'Type', value: getColoredType(issue.type), icon: getTypeIcon(issue.type) },
          { label: 'Keywords', value: issue.keywords, icon: actionIcons.keywords },
          { label: 'Priority', value: `${getPriorityIcon(issue.priority)} ${getColoredPriority(issue.priority)}`, icon: actionIcons.priority },
          { label: 'Status', value: `${getStatusIcon(issue.status)} ${getColoredStatus(issue.status)}`, icon: actionIcons.status },
          { label: 'Folder', value: formatPath(issue.folderPath || ''), icon: actionIcons.folder }
        ];

        if (actualParentId) {
          tableData.push({ label: 'Parent', value: actualParentId, icon: actionIcons.parent });
        }

        displayInfoTable(tableData);

        // Next steps
        const nextSteps = [
          `Edit details: ppp issue update ${issue.id} "<new_name>"`,
          `View hierarchy: ppp issue list ${issue.id}`,
          `Add to sprint: ppp sprint add ${issue.id} <sprint_no>`
        ];
        displayNextSteps('Next Steps', nextSteps);
      } catch (error) {
        displayErrorHeader('Issue Creation Failed');
        displaySimpleError(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        // Enhanced UI display
        displaySuccessHeader('Issue Update Successful!', actionIcons.update);

        const tableData = [
          { label: 'ID', value: updatedIssue.id, icon: actionIcons.id },
          { label: 'Name', value: updatedIssue.name, icon: actionIcons.name },
          { label: 'Type', value: getColoredType(updatedIssue.type), icon: getTypeIcon(updatedIssue.type) },
          { label: 'Keywords', value: updatedIssue.keywords, icon: actionIcons.keywords },
          { label: 'Status', value: `${getStatusIcon(updatedIssue.status)} ${getColoredStatus(updatedIssue.status)}`, icon: actionIcons.status },
          { label: 'Priority', value: `${getPriorityIcon(updatedIssue.priority)} ${getColoredPriority(updatedIssue.priority)}`, icon: actionIcons.priority }
        ];

        if (updatedIssue.assignee) {
          tableData.push({ label: 'Assignee', value: updatedIssue.assignee, icon: '👤' });
        }

        displayInfoTable(tableData);

        // Show folder update notification if name was updated
        if (name && updatedIssue.folderPath) {
          displaySimpleSuccess(`${actionIcons.folder} Folder updated: ${formatPath(updatedIssue.folderPath)}`, actionIcons.info);
        }
      } catch (error) {
        displayErrorHeader('Issue Update Failed');
        displaySimpleError(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          displayWarningHeader('Confirm Issue Deletion', actionIcons.warning);
          displaySimpleWarning(`This will move issue ${issueId} to archive. Use --force to confirm deletion.`);
          process.exit(1);
        }

        await hybridManager.deleteIssue(issueId);

        displaySuccessHeader('Issue Deletion Successful!', actionIcons.delete);
        
        displaySimpleSuccess(`${actionIcons.archive} Issue ${issueId} has been moved to archive`, actionIcons.info);
        
        const summaryItems = [
          { label: 'Archive Location', value: '.ppp/_archived/' },
          { label: 'Parent issues', value: 'Updated automatically' },
          { label: 'Sprint assignments', value: 'Removed automatically' }
        ];
        displaySummary('Archive Details', summaryItems);
      } catch (error) {
        displayErrorHeader('Issue Deletion Failed');
        displaySimpleError(`Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    .option('--top-level', 'Show only top-level issues (no parent)')
    .option('--level <level>', 'Show all issues up to specified feature level (1, 2, 3)')
    .action(async (issueId, options) => {
      try {
        // Validate mutually exclusive options
        if (options.topLevel && options.level) {
          console.error('[ERROR] --top-level and --level options cannot be used together');
          process.exit(1);
        }

        if (options.level && (options.level < 1 || options.level > 3)) {
          console.error('[ERROR] --level must be 1, 2, or 3');
          process.exit(1);
        }

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
          // Handle --top-level and --level options
          if (options.topLevel) {
            // Force parentId to null for top-level issues
            effectiveParentId = null;
          } else if (options.level) {
            // For level filtering, we need to get all issues first and filter by level
            effectiveParentId = options.parent; // undefined to get all issues if no parent specified
          } else {
            // Default behavior: show only top-level issues (no parent)
            effectiveParentId = options.parent !== undefined ? options.parent : null;
          }

          issues = await hybridManager.listIssues({
            parentId: effectiveParentId,
            type: options.type as IssueType,
            status: options.status,
            assignee: options.assignee,
            labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : undefined,
            sprintId: options.sprint
          });

          // Apply level-based filtering if needed
          if (options.level || options.topLevel) {
            const level = options.level ? parseInt(options.level) : 0;
            issues = issues.filter(issue => matchesLevelFilter(issue, level, options.topLevel, issues));
          }
        }

        // Enhanced empty state messages with emojis
        if (issues.length === 0) {
          if (parentIssue) {
            console.log(`\n${getTypeIcon(parentIssue.type)} Hierarchical view under ${parentIssue.id}: ${parentIssue.name}`);
            console.log('═'.repeat(65));
            console.log('\n💭 No descendant issues found under this parent.');
            console.log('   Create child issues with: ppp issue create <type> <parent_id> "<name>"');
          } else if (options.level) {
            console.log(`\n🏗️  Issues up to level ${options.level}:`);
            console.log('═'.repeat(25));
            console.log(`\n💭 No issues found up to level ${options.level}.`);
            if (options.level === 1) {
              console.log('   Create one with: ppp issue create feature "<name>"');
            } else {
              console.log(`   Create features with: ppp issue create feature <parent_id> "<name>"`);
            }
          } else if (options.topLevel) {
            console.log('\n🏗️  Top-level issues:');
            console.log('═'.repeat(25));
            console.log('\n💭 No top-level issues found.');
            console.log('   Create one with: ppp issue create feature "<name>"');
          } else if (effectiveParentId) {
            console.log(`\n👥 Issues with parent ${effectiveParentId}:`);
            console.log('═'.repeat(45));
            console.log('\n💭 No issues found with this parent.');
            console.log('   Create child issues with: ppp issue create <type> <parent_id> "<name>"');
          } else {
            console.log('\n🏗️  Top-level issues:');
            console.log('═'.repeat(25));
            console.log('\n💭 No issues found. Create one with: ppp issue create feature "<name>"');
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
        } else if (options.level) {
          // Level-filtered view
          console.log(`\n🏗️  Issues up to level ${options.level}:`);
          console.log('═'.repeat(25));
        } else if (options.topLevel) {
          // Explicitly requested top-level view
          console.log('\n🏗️  Top-level issues:');
          console.log('═'.repeat(25));
        } else if (effectiveParentId) {
          // Flat view filtered by parent
          console.log(`\n👥 Issues with parent ${effectiveParentId}:`);
          console.log('═'.repeat(45));
        } else {
          // Default: top-level issues (no parent)
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
        } else if (options.level) {
          console.log(`\n📊 Total: ${issues.length} issues up to level ${options.level}`);
        } else if (options.topLevel) {
          console.log(`\n📊 Total: ${issues.length} top-level issues`);
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
