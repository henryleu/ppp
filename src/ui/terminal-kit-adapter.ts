/**
 * Terminal-kit adapter for PPP interactive UI
 * Provides a clean interface to terminal-kit functionality
 */

import terminalKit from 'terminal-kit';
import type { Terminal } from 'terminal-kit';
import { UIColors, KeyBinding, MenuOption } from '../types/ui.js';

export class TerminalAdapter {
  public terminal: Terminal;
  private keyBindings: Map<string, KeyBinding> = new Map();
  private isRawMode = false;

  constructor() {
    this.terminal = terminalKit.terminal;
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    // Handle Ctrl+C gracefully
    this.terminal.on('key', (name: string, matches: any, data: any) => {
      if (name === 'CTRL_C') {
        this.cleanup();
        process.exit(0);
      }
    });
  }

  /**
   * Initialize terminal for interactive mode
   */
  async init(): Promise<void> {
    this.terminal.fullscreen();
    this.terminal.hideCursor();
    this.terminal.grabInput();
    this.isRawMode = true;
    
    // Clear screen and set up initial display
    this.terminal.clear();
  }

  /**
   * Cleanup terminal state
   */
  cleanup(): void {
    if (this.isRawMode) {
      this.terminal.showCursor();
      this.terminal.fullscreen(false);
      this.terminal.grabInput(false);
      this.isRawMode = false;
    }
  }

  /**
   * Clear the terminal screen
   */
  clear(): void {
    this.terminal.clear();
  }

  /**
   * Move cursor to specific position
   */
  moveTo(x: number, y: number): void {
    this.terminal.moveTo(x, y);
  }

  /**
   * Get terminal dimensions
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.terminal.width,
      height: this.terminal.height
    };
  }

  /**
   * Write text with color
   */
  write(text: string, color?: UIColors): void {
    if (color) {
      this.terminal(color + text + UIColors.RESET);
    } else {
      this.terminal(text);
    }
  }

  /**
   * Write text at specific position
   */
  writeAt(x: number, y: number, text: string, color?: UIColors): void {
    this.terminal.moveTo(x, y);
    this.write(text, color);
  }

  /**
   * Draw a box with title
   */
  drawBox(x: number, y: number, width: number, height: number, title?: string): void {
    // Draw top border
    this.terminal.moveTo(x, y);
    this.terminal('┌');
    if (title) {
      const titleText = `─ ${title} `;
      const remainingWidth = width - titleText.length - 2;
      this.terminal(titleText);
      this.terminal('─'.repeat(Math.max(0, remainingWidth)));
    } else {
      this.terminal('─'.repeat(width - 2));
    }
    this.terminal('┐');

    // Draw sides
    for (let i = 1; i < height - 1; i++) {
      this.terminal.moveTo(x, y + i);
      this.terminal('│');
      this.terminal.moveTo(x + width - 1, y + i);
      this.terminal('│');
    }

    // Draw bottom border
    this.terminal.moveTo(x, y + height - 1);
    this.terminal('└');
    this.terminal('─'.repeat(width - 2));
    this.terminal('┘');
  }

  /**
   * Create an interactive menu
   */
  async showMenu(options: MenuOption[], title?: string): Promise<MenuOption | null> {
    return new Promise((resolve) => {
      const menuItems = options.map(opt => 
        opt.icon ? `${opt.icon}  ${opt.label}` : opt.label
      );

      this.terminal.singleLineMenu(
        menuItems,
        {
          style: this.terminal.inverse,
          selectedStyle: this.terminal.dim.blue.bgGreen,
          exitOnUnexpectedKey: true,
          keyBindings: {
            ESCAPE: 'cancel',
            q: 'cancel'
          }
        },
        (error: any, response: any) => {
          if (error || !response) {
            resolve(null);
            return;
          }

          const selectedOption = options[response.selectedIndex];
          resolve(selectedOption);
        }
      );
    });
  }

  /**
   * Show a confirmation dialog
   */
  async showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.terminal.yesOrNo(
        { yes: ['y', 'ENTER'], no: ['n', 'ESCAPE'] },
        (error: any, result: boolean) => {
          resolve(result || false);
        }
      );
      this.terminal('\n%s (y/n): ', message);
    });
  }

  /**
   * Show input field with autocompletion
   */
  async showInput(prompt: string, autoComplete?: string[], placeholder?: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.terminal(prompt + ': ');
      
      const options: any = {
        style: this.terminal.green,
        cancelable: true
      };

      if (autoComplete && autoComplete.length > 0) {
        options.autoComplete = autoComplete;
        options.autoCompleteMenu = true;
        options.autoCompleteHint = true;
      }

      if (placeholder) {
        options.default = placeholder;
      }

      this.terminal.inputField(options, (error: any, input: string) => {
        this.terminal('\n');
        if (error) {
          resolve(null);
          return;
        }
        resolve(input || null);
      });
    });
  }

  /**
   * Show progress bar
   */
  showProgress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const width = 30;
    const filled = Math.round((width * current) / total);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    
    this.terminal('\r%s [%s] %d%%', 
      message || 'Progress', 
      bar, 
      percentage
    );
  }

  /**
   * Register key binding
   */
  registerKeyBinding(binding: KeyBinding): void {
    const keyCode = this.buildKeyCode(binding);
    this.keyBindings.set(keyCode, binding);
  }

  /**
   * Handle key press events
   */
  async handleKeyPress(): Promise<void> {
    return new Promise((resolve) => {
      this.terminal.on('key', async (name: string) => {
        const binding = this.keyBindings.get(name);
        if (binding) {
          await binding.action();
        }
        resolve();
      });
    });
  }

  private buildKeyCode(binding: KeyBinding): string {
    let keyCode = binding.key.toUpperCase();
    if (binding.ctrl) keyCode = 'CTRL_' + keyCode;
    if (binding.alt) keyCode = 'ALT_' + keyCode;
    if (binding.shift) keyCode = 'SHIFT_' + keyCode;
    return keyCode;
  }

  /**
   * Create a table display
   */
  displayTable(headers: string[], rows: string[][], options?: {
    width?: number;
    maxWidth?: number;
    fit?: boolean;
  }): void {
    const termWidth = this.terminal.width;
    const tableWidth = options?.width || termWidth - 4;
    
    // Calculate column widths
    const colCount = headers.length;
    const colWidth = Math.floor(tableWidth / colCount);
    
    // Draw header
    this.terminal('┌');
    for (let i = 0; i < colCount; i++) {
      this.terminal('─'.repeat(colWidth));
      if (i < colCount - 1) this.terminal('┬');
    }
    this.terminal('┐\n');
    
    // Header row
    this.terminal('│');
    headers.forEach((header, i) => {
      const padded = header.padEnd(colWidth - 1).slice(0, colWidth - 1);
      this.terminal.bold(padded);
      this.terminal('│');
    });
    this.terminal('\n');
    
    // Header separator
    this.terminal('├');
    for (let i = 0; i < colCount; i++) {
      this.terminal('─'.repeat(colWidth));
      if (i < colCount - 1) this.terminal('┼');
    }
    this.terminal('┤\n');
    
    // Data rows
    rows.forEach(row => {
      this.terminal('│');
      row.forEach((cell, i) => {
        const padded = cell.padEnd(colWidth - 1).slice(0, colWidth - 1);
        this.terminal(padded);
        this.terminal('│');
      });
      this.terminal('\n');
    });
    
    // Bottom border
    this.terminal('└');
    for (let i = 0; i < colCount; i++) {
      this.terminal('─'.repeat(colWidth));
      if (i < colCount - 1) this.terminal('┴');
    }
    this.terminal('┘\n');
  }

  /**
   * Show status bar at bottom
   */
  showStatusBar(message: string, shortcuts?: string[]): void {
    const { width, height } = this.getSize();
    
    this.terminal.moveTo(1, height);
    this.terminal.eraseLine();
    
    // Background color for status bar
    this.terminal.bgBlue.black(message.padEnd(width));
    
    if (shortcuts && shortcuts.length > 0) {
      this.terminal.moveTo(width - shortcuts.join(' ').length - 2, height);
      this.terminal.bgBlue.white(shortcuts.join(' '));
    }
  }
}