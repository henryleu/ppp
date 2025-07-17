import Table from 'cli-table3';

export interface TableOptions {
  head: string[];
  colWidths?: number[];
}

export function createTable(options: TableOptions): Table.Table {
  return new Table({
    head: options.head,
    colWidths: options.colWidths,
    style: {
      'padding-left': 1,
      'padding-right': 1,
      head: [],
      border: []
    },
    chars: {
      'top': '-',
      'top-mid': '+',
      'top-left': '+',
      'top-right': '+',
      'bottom': '-',
      'bottom-mid': '+',
      'bottom-left': '+',
      'bottom-right': '+',
      'left': '|',
      'left-mid': '+',
      'mid': '-',
      'mid-mid': '+',
      'right': '|',
      'right-mid': '+',
      'middle': '|'
    }
  });
}