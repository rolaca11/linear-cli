import { Command } from 'commander';
import { getClient, resolveTeamId } from '../client.js';
import { outputJson, outputTable, outputDetail, formatDate, success, error } from '../output.js';
import type { GlobalOptions } from '../types/index.js';

export function createTeamCommands(): Command {
  const teams = new Command('teams')
    .alias('team')
    .alias('t')
    .description('Manage teams');

  teams
    .command('list')
    .alias('ls')
    .description('List all teams')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions) => {
      try {
        const client = getClient();
        const teams = await client.teams();

        if (options.json) {
          const teamsData = teams.nodes.map(team => ({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            private: team.private,
            createdAt: team.createdAt
          }));
          outputJson(teamsData);
          return;
        }

        const rows = teams.nodes.map(team => [
          team.key,
          team.name,
          team.description?.substring(0, 40) || '-',
          team.private ? 'Yes' : 'No'
        ]);

        outputTable(['Key', 'Name', 'Description', 'Private'], rows, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list teams');
        process.exit(1);
      }
    });

  teams
    .command('view <id>')
    .alias('show')
    .description('View team details')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const teamId = await resolveTeamId(id);
        const team = await client.team(teamId);

        const members = await team.members();
        const states = await team.states();
        const labels = await team.labels();

        if (options.json) {
          outputJson({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            private: team.private,
            timezone: team.timezone,
            members: members.nodes.map(m => ({ id: m.id, name: m.name, email: m.email })),
            states: states.nodes.map(s => ({ id: s.id, name: s.name, color: s.color, type: s.type })),
            labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
            createdAt: team.createdAt
          });
          return;
        }

        console.log();
        outputDetail({
          'Name': team.name,
          'Key': team.key,
          'Description': team.description || '-',
          'Private': team.private ? 'Yes' : 'No',
          'Timezone': team.timezone || '-',
          'Members': members.nodes.length.toString(),
          'Workflow States': states.nodes.map(s => s.name).join(', '),
          'Labels': labels.nodes.length.toString(),
          'Created': formatDate(team.createdAt)
        }, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to view team');
        process.exit(1);
      }
    });

  return teams;
}
