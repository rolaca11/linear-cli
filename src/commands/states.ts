import { Command } from 'commander';
import chalk from 'chalk';
import { getClient, resolveTeamId } from '../client.js';
import { getDefaultTeam } from '../config.js';
import { outputJson, outputTable, error } from '../output.js';
import type { GlobalOptions } from '../types/index.js';

export function createStateCommands(): Command {
  const states = new Command('states')
    .alias('state')
    .alias('s')
    .description('Manage workflow states');

  states
    .command('list')
    .alias('ls')
    .description('List workflow states')
    .option('--team <team>', 'Filter by team')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions & { team?: string }) => {
      try {
        const client = getClient();
        const teamFilter = options.team || getDefaultTeam();

        let filter: Record<string, unknown> = {};

        if (teamFilter) {
          const teamId = await resolveTeamId(teamFilter);
          filter.team = { id: { eq: teamId } };
        }

        const states = await client.workflowStates({
          filter: Object.keys(filter).length > 0 ? filter : undefined
        });

        // Sort by position within each team
        const sortedStates = [...states.nodes].sort((a, b) => a.position - b.position);

        if (options.json) {
          const statesData = await Promise.all(
            sortedStates.map(async (state) => {
              const team = await state.team;
              return {
                id: state.id,
                name: state.name,
                color: state.color,
                type: state.type,
                position: state.position,
                team: team ? { name: team.name, key: team.key } : null,
                description: state.description
              };
            })
          );
          outputJson(statesData);
          return;
        }

        const rows = await Promise.all(
          sortedStates.map(async (state) => {
            const team = await state.team;
            const colorBox = options.noColor ? '' : chalk.hex(state.color)('\u2588\u2588');
            return [
              colorBox,
              state.name,
              team?.key || '-',
              state.type,
              state.description?.substring(0, 30) || '-'
            ];
          })
        );

        const headers = options.noColor
          ? ['Name', 'Team', 'Type', 'Description']
          : ['', 'Name', 'Team', 'Type', 'Description'];

        if (options.noColor) {
          const rowsWithoutColor = rows.map(r => r.slice(1));
          outputTable(headers, rowsWithoutColor, options);
        } else {
          outputTable(headers, rows, options);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list workflow states');
        process.exit(1);
      }
    });

  return states;
}
