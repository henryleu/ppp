/**
 * UI-specific type definitions for PPP interactive mode
 */

export interface UIView {
  id: string;
  title: string;
  component: string;
  breadcrumb?: string[];
}

export interface SessionState {
  currentView: UIView;
  previousViews: UIView[];
  selectedItems: string[];
  filters: Record<string, any>;
  searchQuery: string;
  projectStatus: ProjectStatus;
}

export interface ProjectStatus {
  initialized: boolean;
  activeSprint?: string;
  totalIssues: number;
  totalSprints: number;
}

export interface SearchConfig {
  items: SearchableItem[];
  searchFields: string[];
  fuzzyMatch: boolean;
  maxResults: number;
  groupBy?: string;
  sortBy?: string;
}

export interface SearchableItem {
  id: string;
  name: string;
  type: 'issue' | 'sprint' | 'user';
  searchText: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  items: SearchableItem[];
  totalCount: number;
  query: string;
  executionTime: number;
}

export interface FilterConfig {
  field: string;
  value: any;
  operator?: 'equals' | 'contains' | 'startsWith' | 'in';
}

export interface DialogConfig {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'confirm' | 'input';
  buttons?: string[];
  defaultValue?: string;
  placeholder?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  action: () => Promise<void> | void;
}

export interface MenuOption {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => Promise<void> | void;
  submenu?: MenuOption[];
}

export interface TableColumn {
  key: string;
  title: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any, row: any) => string;
}

export interface ListConfig {
  items: any[];
  columns: TableColumn[];
  searchable: boolean;
  multiSelect: boolean;
  sortable: boolean;
  filterable: boolean;
  pageSize?: number;
}

export enum UIColors {
  PRIMARY = '\x1b[36m',      // Cyan
  SUCCESS = '\x1b[32m',      // Green  
  WARNING = '\x1b[33m',      // Yellow
  ERROR = '\x1b[31m',        // Red
  INFO = '\x1b[34m',         // Blue
  HIGHLIGHT = '\x1b[93m',    // Bright Yellow
  DISABLED = '\x1b[90m',     // Gray
  RESET = '\x1b[0m'          // Reset
}

export interface UITheme {
  colors: typeof UIColors;
  icons: Record<string, string>;
  borders: Record<string, string>;
}