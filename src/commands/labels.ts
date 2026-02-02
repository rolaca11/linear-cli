import { Command } from '@naerth/commander-autocomplete';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { LinearDocument } from '@linear/sdk';
import { getClient, resolveTeamId } from '../client.js';
import { getDefaultTeam } from '../config.js';
import { outputJson, outputTable, success, error } from '../output.js';
import {
  isInteractiveMode,
  promptForText,
  promptForConfirm,
  promptForColor,
  getTeamChoices
} from '../prompts.js';
import type { LabelCreateOptions, GlobalOptions } from '../types/index.js';

export function createLabelCommands(): Command {
  const labels = new Command('labels')
    .alias('label')
    .alias('l')
    .description('Manage labels');

  labels
    .command('list')
    .alias('ls')
    .description('List labels')
    .option('--team <team>', 'Filter by team')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions & { team?: string }) => {
      try {
        const client = getClient();

        let filter: Record<string, unknown> = {};

        if (options.team) {
          const teamId = await resolveTeamId(options.team);
          filter.team = { id: { eq: teamId } };
        }

        const labels = await client.issueLabels({
          filter: Object.keys(filter).length > 0 ? filter : undefined
        });

        if (options.json) {
          const labelsData = await Promise.all(
            labels.nodes.map(async (label) => {
              const team = await label.team;
              const parent = await label.parent;
              return {
                id: label.id,
                name: label.name,
                color: label.color,
                description: label.description,
                team: team ? { name: team.name, key: team.key } : null,
                parent: parent ? { name: parent.name } : null
              };
            })
          );
          outputJson(labelsData);
          return;
        }

        const rows = await Promise.all(
          labels.nodes.map(async (label) => {
            const team = await label.team;
            const parent = await label.parent;
            const colorBox = options.noColor ? '' : chalk.hex(label.color)('\u2588\u2588');
            return [
              colorBox,
              label.name,
              team?.key || 'Workspace',
              parent?.name || '-',
              label.description?.substring(0, 30) || '-'
            ];
          })
        );

        const headers = options.noColor
          ? ['Name', 'Scope', 'Parent', 'Description']
          : ['', 'Name', 'Scope', 'Parent', 'Description'];

        if (options.noColor) {
          const rowsWithoutColor = rows.map(r => r.slice(1));
          outputTable(headers, rowsWithoutColor, options);
        } else {
          outputTable(headers, rows, options);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list labels');
        process.exit(1);
      }
    });

  labels
    .command('create')
    .description('Create a new label')
    .option('--name <name>', 'Label name')
    .option('--team <team>', 'Team name or ID (omit for workspace label)')
    .option('--color <color>', 'Label color (hex, e.g., #ff0000)')
    .option('--description <desc>', 'Label description')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .option('-y, --no-interactive', 'Disable interactive prompts')
    .action(async (options: LabelCreateOptions & { color?: string }) => {
      try {
        const client = getClient();
        const interactive = isInteractiveMode(options);

        let name = options.name;
        let teamId: string | undefined;
        let labelColor = options.color;
        let description = options.description;

        // Get name (required)
        if (!name) {
          if (interactive) {
            name = await promptForText('Enter label name:', { required: true });
          } else {
            error('Name is required. Use --name to specify.');
            process.exit(1);
          }
        }

        // Resolve team from flags
        if (options.team) {
          teamId = await resolveTeamId(options.team);
        } else if (interactive) {
          // Ask about team scope
          const teamChoices = await getTeamChoices();
          teamChoices.unshift({ name: 'Workspace (available to all teams)', value: '' });

          const { selectedTeam } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedTeam',
              message: 'Select team scope:',
              choices: teamChoices
            }
          ]);

          if (selectedTeam) {
            teamId = selectedTeam;
          }
        }

        // Interactive prompts for optional fields
        if (interactive && !options.color && !options.description) {
          // Color
          labelColor = await promptForColor('Select label color:');

          // Description
          const addDesc = await promptForConfirm('Add description?', false);
          if (addDesc) {
            description = await promptForText('Enter description:');
          }
        }

        const input: LinearDocument.IssueLabelCreateInput = {
          name: name!
        };

        if (teamId) {
          input.teamId = teamId;
        }

        if (labelColor) {
          input.color = labelColor;
        }

        if (description) {
          input.description = description;
        }

        const result = await client.createIssueLabel(input);

        if (!result.success) {
          error('Failed to create label');
          process.exit(1);
        }

        const label = await result.issueLabel;

        if (options.json) {
          outputJson({
            success: true,
            label: {
              id: label?.id,
              name: label?.name,
              color: label?.color
            }
          });
        } else {
          success(`Created label: ${label?.name}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to create label');
        process.exit(1);
      }
    });

  return labels;
}
