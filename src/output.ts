import chalk from 'chalk';
import Table from 'cli-table3';
import type { GlobalOptions } from './types/index.js';

export function outputJson(data: unknown, options?: GlobalOptions): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputTable(headers: string[], rows: string[][], options?: GlobalOptions): void {
  const table = new Table({
    head: options?.noColor ? headers : headers.map(h => chalk.bold.cyan(h)),
    style: {
      head: [],
      border: []
    }
  });

  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

export function outputDetail(fields: Record<string, string | undefined | null>, options?: GlobalOptions): void {
  const maxKeyLength = Math.max(...Object.keys(fields).map(k => k.length));

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;

    const paddedKey = key.padEnd(maxKeyLength);
    if (options?.noColor) {
      console.log(`${paddedKey}  ${value}`);
    } else {
      console.log(`${chalk.bold.cyan(paddedKey)}  ${value}`);
    }
  }
}

export function formatPriority(priority: number, noColor?: boolean): string {
  const labels: Record<number, string> = {
    0: 'No priority',
    1: 'Urgent',
    2: 'High',
    3: 'Medium',
    4: 'Low'
  };

  const label = labels[priority] || 'Unknown';

  if (noColor) return label;

  switch (priority) {
    case 1: return chalk.red.bold(label);
    case 2: return chalk.yellow(label);
    case 3: return chalk.blue(label);
    case 4: return chalk.gray(label);
    default: return chalk.gray(label);
  }
}

export function formatState(state: { name: string; color: string }, noColor?: boolean): string {
  if (noColor) return state.name;
  return chalk.hex(state.color)(state.name);
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString();
}

export function success(message: string, noColor?: boolean): void {
  if (noColor) {
    console.log(`[OK] ${message}`);
  } else {
    console.log(chalk.green('✓') + ' ' + message);
  }
}

export function error(message: string, noColor?: boolean): void {
  if (noColor) {
    console.error(`[ERROR] ${message}`);
  } else {
    console.error(chalk.red('✗') + ' ' + message);
  }
}

export function warn(message: string, noColor?: boolean): void {
  if (noColor) {
    console.warn(`[WARN] ${message}`);
  } else {
    console.warn(chalk.yellow('!') + ' ' + message);
  }
}

export function info(message: string, noColor?: boolean): void {
  if (noColor) {
    console.log(`[INFO] ${message}`);
  } else {
    console.log(chalk.blue('i') + ' ' + message);
  }
}
