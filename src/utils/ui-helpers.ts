import Table from 'cli-table3';
import { IssueType, IssueStatus, IssuePriority } from '../types/issue.js';
import { SprintStatus } from '../types/sprint.js';

/**
 * UI Helper Functions for Enhanced Command Line Display
 * Provides consistent formatting with emojis, colors, and structured layouts
 */

// Color constants
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[91m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  magenta: '\x1b[95m',
  cyan: '\x1b[96m',
  white: '\x1b[97m',
  gray: '\x1b[90m'
};

// Icon mappings
export function getTypeIcon(type: IssueType | string): string {
  switch (type) {
    case IssueType.FEATURE:
    case 'feature':
      return '🎯';
    case IssueType.STORY:
    case 'story':
      return '📖';
    case IssueType.TASK:
    case 'task':
      return '✅';
    case IssueType.BUG:
    case 'bug':
      return '🐛';
    default:
      return '📋';
  }
}

export function getStatusIcon(status: IssueStatus | SprintStatus | string): string {
  switch (status) {
    case IssueStatus.NEW:
    case 'new':
      return '🆕';
    case IssueStatus.IN_PROGRESS:
    case 'in_progress':
    case 'active':
      return '🔄';
    case IssueStatus.DONE:
    case 'done':
    case 'completed':
      return '✅';
    case IssueStatus.BLOCKED:
    case 'blocked':
      return '🚫';
    case IssueStatus.CANCELLED:
    case 'cancelled':
      return '❌';
    case SprintStatus.PLANNED:
    case 'planned':
      return '📋';
    default:
      return '📄';
  }
}

export function getPriorityIcon(priority: IssuePriority | string): string {
  switch (priority) {
    case IssuePriority.HIGH:
    case 'high':
      return '🔴';
    case IssuePriority.MEDIUM:
    case 'medium':
      return '🟡';
    case IssuePriority.LOW:
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

// Action icons
export const actionIcons = {
  create: '➕',
  update: '🔄',
  delete: '🗑️',
  activate: '⚡',
  complete: '🏁',
  add: '➕',
  remove: '➖',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: '💡',
  folder: '📁',
  id: '🆔',
  name: '📝',
  keywords: '🏷️ ',
  parent: '👤',
  status: '📊',
  priority: '🎯',
  sprint: '🚀',
  date: '📅',
  archive: '📦'
};

// Border styles
export const borders = {
  success: '═'.repeat(30),
  warning: '─'.repeat(30),
  error: '×'.repeat(30),
  info: '·'.repeat(30)
};

/**
 * Display a success header with icon and border
 */
export function displaySuccessHeader(title: string, customIcon?: string): void {
  const icon = customIcon || actionIcons.success;
  console.log(`\n${icon} ${title}`);
  console.log(borders.success);
}

/**
 * Display a warning header with icon and border
 */
export function displayWarningHeader(title: string, customIcon?: string): void {
  const icon = customIcon || actionIcons.warning;
  console.log(`\n${icon} ${title}`);
  console.log(borders.warning);
}

/**
 * Display an error header with icon and border
 */
export function displayErrorHeader(title: string, customIcon?: string): void {
  const icon = customIcon || actionIcons.error;
  console.log(`\n${icon} ${title}`);
  console.log(borders.error);
}

/**
 * Display an info header with icon and border
 */
export function displayInfoHeader(title: string, customIcon?: string): void {
  const icon = customIcon || actionIcons.info;
  console.log(`\n${icon} ${title}`);
  console.log(borders.info);
}

/**
 * Create a formatted info table for displaying key-value pairs
 */
export function createInfoTable(data: Array<{ label: string; value: string; icon?: string }>): string {
  const table = new Table({
    head: ['Field', 'Value'],
    colWidths: [20, 40],
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

  data.forEach(row => {
    const label = row.icon ? `${row.icon} ${row.label}` : row.label;
    table.push([label, row.value]);
  });

  return table.toString();
}

/**
 * Display a formatted info table
 */
export function displayInfoTable(data: Array<{ label: string; value: string; icon?: string }>): void {
  console.log('\n' + createInfoTable(data));
}

/**
 * Display next steps or helpful tips
 */
export function displayNextSteps(title: string, steps: string[]): void {
  console.log(`\n${actionIcons.info} ${title}:`);
  steps.forEach(step => {
    console.log(`   • ${step}`);
  });
}

/**
 * Display a simple success message
 */
export function displaySimpleSuccess(message: string, icon?: string): void {
  const successIcon = icon || actionIcons.success;
  console.log(`\n${successIcon} ${message}\n`);
}

/**
 * Display a simple warning message
 */
export function displaySimpleWarning(message: string, icon?: string): void {
  const warningIcon = icon || actionIcons.warning;
  console.log(`\n${warningIcon} ${message}\n`);
}

/**
 * Display a simple error message
 */
export function displaySimpleError(message: string, icon?: string): void {
  const errorIcon = icon || actionIcons.error;
  console.log(`\n${errorIcon} ${message}\n`);
}

/**
 * Display a summary section with statistics
 */
export function displaySummary(title: string, items: Array<{ label: string; value: string | number }>): void {
  console.log(`\n${actionIcons.info} ${title}:`);
  items.forEach(item => {
    console.log(`   • ${item.label}: ${item.value}`);
  });
}

/**
 * Format relative paths to be more readable
 */
export function formatPath(path: string): string {
  return path.replace(/^.*\.ppp\//, '.ppp/');
}

/**
 * Truncate text to fit display width
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get colored status text for display
 */
export function getColoredStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'new':
      return `${colors.cyan}${status}${colors.reset}`;
    case 'in_progress':
    case 'active':
      return `${colors.yellow}${status}${colors.reset}`;
    case 'done':
    case 'completed':
      return `${colors.green}${status}${colors.reset}`;
    case 'blocked':
      return `${colors.red}${status}${colors.reset}`;
    case 'cancelled':
      return `${colors.gray}${status}${colors.reset}`;
    case 'planned':
      return `${colors.blue}${status}${colors.reset}`;
    default:
      return status;
  }
}

/**
 * Get colored priority text for display
 */
export function getColoredPriority(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'high':
      return `${colors.red}${priority}${colors.reset}`;
    case 'medium':
      return `${colors.yellow}${priority}${colors.reset}`;
    case 'low':
      return `${colors.green}${priority}${colors.reset}`;
    default:
      return priority;
  }
}

/**
 * Get colored type text for display
 */
export function getColoredType(type: string): string {
  switch (type.toLowerCase()) {
    case 'feature':
      return `${colors.blue}${type}${colors.reset}`;
    case 'story':
      return `${colors.cyan}${type}${colors.reset}`;
    case 'task':
      return `${colors.white}${type}${colors.reset}`;
    case 'bug':
      return `${colors.magenta}${type}${colors.reset}`;
    default:
      return type;
  }
}
