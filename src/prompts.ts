import inquirer from 'inquirer';
import { getClient } from './client.js';
import type { GlobalOptions } from './types/index.js';

/**
 * Check if interactive mode should be used
 * Returns false if:
 * - --no-interactive/-y flag is set
 * - --json flag is set (implies non-interactive)
 * - LINEAR_NO_INTERACTIVE env var is set
 * - stdin is not a TTY (piped input)
 */
export function isInteractiveMode(options: GlobalOptions & { noInteractive?: boolean }): boolean {
  // Check flag
  if (options.noInteractive) {
    return false;
  }

  // JSON output implies non-interactive
  if (options.json) {
    return false;
  }

  // Check environment variable
  if (process.env.LINEAR_NO_INTERACTIVE === '1' || process.env.LINEAR_NO_INTERACTIVE === 'true') {
    return false;
  }

  // Check if stdin is a TTY
  if (!process.stdin.isTTY) {
    return false;
  }

  return true;
}

export interface Choice {
  name: string;
  value: string;
}

// ============= API Choice Fetchers =============

export async function getTeamChoices(): Promise<Choice[]> {
  const client = getClient();
  const teams = await client.teams();

  return teams.nodes.map(team => ({
    name: `${team.key} - ${team.name}`,
    value: team.id
  }));
}

export async function getUserChoices(): Promise<Choice[]> {
  const client = getClient();
  const users = await client.users();

  return users.nodes.map(user => ({
    name: user.name,
    value: user.id
  }));
}

export async function getStateChoices(teamId?: string): Promise<Choice[]> {
  const client = getClient();
  const states = await client.workflowStates();

  let filteredStates = states.nodes;

  if (teamId) {
    filteredStates = [];
    for (const state of states.nodes) {
      const team = await state.team;
      if (team?.id === teamId) {
        filteredStates.push(state);
      }
    }
  }

  // Group states by type for better UX
  const typeOrder = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
  filteredStates.sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.type);
    const bIndex = typeOrder.indexOf(b.type);
    return aIndex - bIndex;
  });

  return filteredStates.map(state => ({
    name: `${state.name} (${state.type})`,
    value: state.id
  }));
}

export async function getProjectChoices(): Promise<Choice[]> {
  const client = getClient();
  const projects = await client.projects();

  return projects.nodes.map(project => ({
    name: project.name,
    value: project.id
  }));
}

export async function getLabelChoices(teamId?: string): Promise<Choice[]> {
  const client = getClient();
  const labels = await client.issueLabels();

  let filteredLabels = labels.nodes;

  if (teamId) {
    filteredLabels = [];
    for (const label of labels.nodes) {
      const team = await label.team;
      // Include workspace labels (no team) and team-specific labels
      if (!team || team.id === teamId) {
        filteredLabels.push(label);
      }
    }
  }

  return filteredLabels.map(label => ({
    name: label.name,
    value: label.id
  }));
}

// ============= Static Choices =============

export function getPriorityChoices(): Choice[] {
  return [
    { name: 'No priority', value: '0' },
    { name: 'Urgent', value: '1' },
    { name: 'High', value: '2' },
    { name: 'Medium', value: '3' },
    { name: 'Low', value: '4' }
  ];
}

export function getProjectStateChoices(): Choice[] {
  return [
    { name: 'Planned', value: 'planned' },
    { name: 'Started', value: 'started' },
    { name: 'Paused', value: 'paused' },
    { name: 'Completed', value: 'completed' },
    { name: 'Canceled', value: 'canceled' }
  ];
}

export function getColorPresetChoices(): Choice[] {
  return [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Custom (enter hex)', value: 'custom' }
  ];
}

// ============= Validators =============

export function validateDate(input: string): boolean | string {
  // Allow empty input for optional fields
  if (!input) return true;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input)) {
    return 'Please enter a valid date in YYYY-MM-DD format';
  }

  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return 'Please enter a valid date';
  }

  return true;
}

export function validateHexColor(input: string): boolean | string {
  // Allow empty input for optional fields
  if (!input) return true;

  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  if (!hexRegex.test(input)) {
    return 'Please enter a valid hex color (e.g., #ff0000)';
  }

  return true;
}

export function validateRequired(input: string): boolean | string {
  if (!input || input.trim().length === 0) {
    return 'This field is required';
  }
  return true;
}

// ============= Date Helpers =============

export function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return formatDateISO(nextMonday);
}

export function getTwoWeeksLater(fromDate: string): string {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + 14);
  return formatDateISO(date);
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============= Prompt Helpers =============

export async function promptForTeam(message = 'Select team:'): Promise<string> {
  const choices = await getTeamChoices();
  const { team } = await inquirer.prompt([
    {
      type: 'list',
      name: 'team',
      message,
      choices
    }
  ]);
  return team;
}

export async function promptForUser(message = 'Select user:'): Promise<string | undefined> {
  const choices = await getUserChoices();
  choices.unshift({ name: '(None)', value: '' });

  const { user } = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message,
      choices
    }
  ]);
  return user || undefined;
}

export async function promptForState(teamId?: string, message = 'Select state:'): Promise<string | undefined> {
  const choices = await getStateChoices(teamId);
  choices.unshift({ name: '(Default)', value: '' });

  const { state } = await inquirer.prompt([
    {
      type: 'list',
      name: 'state',
      message,
      choices
    }
  ]);
  return state || undefined;
}

export async function promptForProject(message = 'Select project:'): Promise<string | undefined> {
  const choices = await getProjectChoices();
  choices.unshift({ name: '(None)', value: '' });

  const { project } = await inquirer.prompt([
    {
      type: 'list',
      name: 'project',
      message,
      choices
    }
  ]);
  return project || undefined;
}

export async function promptForLabels(teamId?: string, message = 'Select labels:'): Promise<string[]> {
  const choices = await getLabelChoices(teamId);

  if (choices.length === 0) {
    return [];
  }

  const { labels } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'labels',
      message,
      choices
    }
  ]);
  return labels;
}

export async function promptForPriority(message = 'Select priority:'): Promise<number> {
  const choices = getPriorityChoices();

  const { priority } = await inquirer.prompt([
    {
      type: 'list',
      name: 'priority',
      message,
      choices,
      default: '0'
    }
  ]);
  return parseInt(priority, 10);
}

export async function promptForColor(message = 'Select color:'): Promise<string | undefined> {
  const choices = getColorPresetChoices();

  const { color } = await inquirer.prompt([
    {
      type: 'list',
      name: 'color',
      message,
      choices
    }
  ]);

  if (color === 'custom') {
    const { customColor } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customColor',
        message: 'Enter hex color (e.g., #ff0000):',
        validate: validateHexColor
      }
    ]);
    return customColor || undefined;
  }

  return color || undefined;
}

export async function promptForDate(message: string, defaultValue?: string): Promise<string> {
  const { date } = await inquirer.prompt([
    {
      type: 'input',
      name: 'date',
      message,
      default: defaultValue,
      validate: validateDate
    }
  ]);
  return date;
}

export async function promptForText(message: string, options?: {
  default?: string;
  required?: boolean;
}): Promise<string> {
  const { text } = await inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message,
      default: options?.default,
      validate: options?.required ? validateRequired : undefined
    }
  ]);
  return text;
}

export async function promptForDescription(message = 'Add description?'): Promise<string | undefined> {
  // Check if an editor is available
  const editorAvailable = !!(process.env.EDITOR || process.env.VISUAL);

  const choices = [
    { name: 'Skip', value: 'skip' },
    { name: 'Type inline (single line)', value: 'inline' }
  ];

  if (editorAvailable) {
    choices.push({ name: 'Open external editor', value: 'editor' });
  }

  const { useEditor } = await inquirer.prompt([
    {
      type: 'list',
      name: 'useEditor',
      message,
      choices
    }
  ]);

  if (useEditor === 'skip') {
    return undefined;
  }

  if (useEditor === 'inline') {
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message
      }
    ]);
    return description?.trim() || undefined;
  }

  // Editor mode - spawn editor manually for better control
  const { spawnSync } = await import('child_process');
  const { mkdtempSync, writeFileSync, readFileSync, unlinkSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');

  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const tmpDir = mkdtempSync(join(tmpdir(), 'linear-cli-'));
  const tmpFile = join(tmpDir, 'description.md');

  try {
    writeFileSync(tmpFile, '');

    const result = spawnSync(editor, [tmpFile], {
      stdio: 'inherit',
      shell: true
    });

    if (result.status !== 0) {
      console.error('Editor exited with non-zero status. Using inline input instead.');
      const { description } = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message
        }
      ]);
      return description?.trim() || undefined;
    }

    const content = readFileSync(tmpFile, 'utf-8');
    return content?.trim() || undefined;
  } catch (err) {
    console.error('Failed to open editor:', err instanceof Error ? err.message : err);
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message
      }
    ]);
    return description?.trim() || undefined;
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function promptForConfirm(message: string, defaultValue = false): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message,
      default: defaultValue
    }
  ]);
  return confirm;
}

export async function promptForMultiSelect<T extends string>(
  message: string,
  choices: Choice[]
): Promise<T[]> {
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message,
      choices
    }
  ]);
  return selected;
}
