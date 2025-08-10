/**
 * Keyboard handler for PPP interactive UI
 * Manages key bindings and navigation shortcuts
 */

import { KeyBinding } from '../../types/ui.js';

export class KeyboardHandler {
  private bindings: Map<string, KeyBinding> = new Map();
  private globalBindings: Map<string, KeyBinding> = new Map();

  constructor() {
    this.setupDefaultBindings();
  }

  /**
   * Register a key binding
   */
  register(binding: KeyBinding, global = false): void {
    const keyCode = this.buildKeyCode(binding);
    
    if (global) {
      this.globalBindings.set(keyCode, binding);
    } else {
      this.bindings.set(keyCode, binding);
    }
  }

  /**
   * Unregister a key binding
   */
  unregister(key: string, ctrl = false, alt = false, shift = false): void {
    const keyCode = this.buildKeyCodeFromParams(key, ctrl, alt, shift);
    this.bindings.delete(keyCode);
    this.globalBindings.delete(keyCode);
  }

  /**
   * Handle key press event
   */
  async handle(keyName: string): Promise<boolean> {
    // Try global bindings first
    const globalBinding = this.globalBindings.get(keyName);
    if (globalBinding) {
      await globalBinding.action();
      return true;
    }

    // Try local bindings
    const binding = this.bindings.get(keyName);
    if (binding) {
      await binding.action();
      return true;
    }

    return false; // Key not handled
  }

  /**
   * Clear all local key bindings (keeps globals)
   */
  clearLocalBindings(): void {
    this.bindings.clear();
  }

  /**
   * Get all registered bindings
   */
  getBindings(): { local: KeyBinding[]; global: KeyBinding[] } {
    return {
      local: Array.from(this.bindings.values()),
      global: Array.from(this.globalBindings.values())
    };
  }

  /**
   * Get help text for current bindings
   */
  getHelpText(): string[] {
    const allBindings = [...this.globalBindings.values(), ...this.bindings.values()];
    
    return allBindings.map(binding => {
      let keyText = binding.key.toUpperCase();
      if (binding.ctrl) keyText = 'Ctrl+' + keyText;
      if (binding.alt) keyText = 'Alt+' + keyText;
      if (binding.shift) keyText = 'Shift+' + keyText;
      
      return `${keyText}: ${binding.description}`;
    });
  }

  /**
   * Convert terminal-kit key name to readable format
   */
  formatKeyName(keyName: string): string {
    const keyMappings: Record<string, string> = {
      'ESCAPE': 'ESC',
      'ENTER': '↵',
      'BACKSPACE': '⌫',
      'TAB': '⇥',
      'UP': '↑',
      'DOWN': '↓',
      'LEFT': '←',
      'RIGHT': '→',
      'CTRL_C': 'Ctrl+C',
      'CTRL_D': 'Ctrl+D',
      'CTRL_Z': 'Ctrl+Z',
    };

    return keyMappings[keyName] || keyName;
  }

  private setupDefaultBindings(): void {
    // Global navigation bindings
    this.register({
      key: 'ESCAPE',
      description: 'Exit or go back',
      action: () => {} // Will be overridden by session manager
    }, true);

    this.register({
      key: 'q',
      description: 'Quit application',
      action: () => {} // Will be overridden by session manager
    }, true);

    // Navigation bindings
    this.register({
      key: 'h',
      description: 'Show help',
      action: () => {} // Will be overridden by components
    });

    this.register({
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => {} // Will be overridden by components
    });
  }

  private buildKeyCode(binding: KeyBinding): string {
    return this.buildKeyCodeFromParams(
      binding.key,
      binding.ctrl || false,
      binding.alt || false,
      binding.shift || false
    );
  }

  private buildKeyCodeFromParams(key: string, ctrl: boolean, alt: boolean, shift: boolean): string {
    let keyCode = key.toUpperCase();
    
    if (ctrl) keyCode = 'CTRL_' + keyCode;
    if (alt) keyCode = 'ALT_' + keyCode;
    if (shift) keyCode = 'SHIFT_' + keyCode;
    
    return keyCode;
  }
}

/**
 * Common key binding presets
 */
export const KeyBindingPresets = {
  // Navigation
  BACK: { key: 'BACKSPACE', description: 'Go back' },
  HOME: { key: 'HOME', description: 'Go to main menu' },
  HELP: { key: 'h', description: 'Show help' },
  
  // List navigation
  MOVE_UP: { key: 'UP', description: 'Move up' },
  MOVE_DOWN: { key: 'DOWN', description: 'Move down' },
  PAGE_UP: { key: 'PAGE_UP', description: 'Page up' },
  PAGE_DOWN: { key: 'PAGE_DOWN', description: 'Page down' },
  SELECT: { key: 'ENTER', description: 'Select item' },
  
  // Search and filter
  SEARCH: { key: '/', description: 'Search' },
  FILTER: { key: 'f', description: 'Filter' },
  CLEAR_SEARCH: { key: 'ESCAPE', description: 'Clear search' },
  
  // Actions
  CREATE: { key: 'c', description: 'Create new' },
  EDIT: { key: 'e', description: 'Edit' },
  DELETE: { key: 'd', description: 'Delete' },
  REFRESH: { key: 'r', description: 'Refresh' },
  
  // Multi-select
  TOGGLE_SELECT: { key: 'SPACE', description: 'Toggle selection' },
  SELECT_ALL: { key: 'a', ctrl: true, description: 'Select all' },
  DESELECT_ALL: { key: 'a', ctrl: true, shift: true, description: 'Deselect all' },
} as const;