import { Command } from '@naerth/commander-autocomplete';
import { LinearDocument } from '@linear/sdk';
import { getClient, resolveTeamId, resolveCycleId } from '../client.js';
import { getDefaultTeam } from '../config.js';
import { outputJson, outputTable, outputDetail, formatDate, success, error } from '../output.js';
import {
  isInteractiveMode,
  promptForTeam,
  promptForText,
  promptForDate,
  promptForConfirm,
  promptForDescription,
  getNextMonday,
  getTwoWeeksLater
} from '../prompts.js';
import type { CycleCreateOptions, GlobalOptions } from '../types/index.js';

export function createCycleCommands(): Command {
  const cycles = new Command('cycles')
    .alias('cycle')
    .alias('c')
    .description('Manage cycles');

  cycles
    .command('list')
    .alias('ls')
    .description('List cycles')
    .option('--team <team>', 'Filter by team')
    .option('--limit <n>', 'Maximum number of cycles', '20')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions & { team?: string; limit: string }) => {
      try {
        const client = getClient();
        const teamFilter = options.team || getDefaultTeam();

        let filter: Record<string, unknown> = {};

        if (teamFilter) {
          const teamId = await resolveTeamId(teamFilter);
          filter.team = { id: { eq: teamId } };
        }

        const cycles = await client.cycles({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: parseInt(options.limit, 10)
        });

        if (options.json) {
          const cyclesData = await Promise.all(
            cycles.nodes.map(async (cycle) => {
              const team = await cycle.team;
              return {
                id: cycle.id,
                number: cycle.number,
                name: cycle.name,
                team: team ? { name: team.name, key: team.key } : null,
                startsAt: cycle.startsAt,
                endsAt: cycle.endsAt,
                progress: cycle.progress,
                completedIssueCountHistory: cycle.completedIssueCountHistory,
                issueCountHistory: cycle.issueCountHistory
              };
            })
          );
          outputJson(cyclesData);
          return;
        }

        const rows = await Promise.all(
          cycles.nodes.map(async (cycle) => {
            const team = await cycle.team;
            const progressPct = Math.round((cycle.progress || 0) * 100);
            const now = new Date();
            const start = new Date(cycle.startsAt);
            const end = new Date(cycle.endsAt);
            let status = 'Upcoming';
            if (now >= start && now <= end) status = 'Active';
            else if (now > end) status = 'Completed';

            return [
              cycle.number.toString(),
              cycle.name || `Cycle ${cycle.number}`,
              team?.key || '-',
              status,
              `${progressPct}%`,
              formatDate(cycle.startsAt),
              formatDate(cycle.endsAt)
            ];
          })
        );

        outputTable(['#', 'Name', 'Team', 'Status', 'Progress', 'Start', 'End'], rows, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list cycles');
        process.exit(1);
      }
    });

  cycles
    .command('view <id>')
    .alias('show')
    .description('View cycle details')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const cycleId = await resolveCycleId(id);
        const cycle = await client.cycle(cycleId);

        const team = await cycle.team;
        const issues = await cycle.issues();

        if (options.json) {
          outputJson({
            id: cycle.id,
            number: cycle.number,
            name: cycle.name,
            description: cycle.description,
            team: team ? { id: team.id, name: team.name, key: team.key } : null,
            startsAt: cycle.startsAt,
            endsAt: cycle.endsAt,
            progress: cycle.progress,
            issueCount: issues.nodes.length,
            completedScopeHistory: cycle.completedScopeHistory,
            scopeHistory: cycle.scopeHistory
          });
          return;
        }

        const progressPct = Math.round((cycle.progress || 0) * 100);
        const now = new Date();
        const start = new Date(cycle.startsAt);
        const end = new Date(cycle.endsAt);
        let status = 'Upcoming';
        if (now >= start && now <= end) status = 'Active';
        else if (now > end) status = 'Completed';

        console.log();
        outputDetail({
          'Number': cycle.number.toString(),
          'Name': cycle.name || '-',
          'Team': team?.name || '-',
          'Status': status,
          'Progress': `${progressPct}%`,
          'Issues': issues.nodes.length.toString(),
          'Start Date': formatDate(cycle.startsAt),
          'End Date': formatDate(cycle.endsAt)
        }, options);

        if (cycle.description) {
          console.log('\nDescription:');
          console.log(cycle.description);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to view cycle');
        process.exit(1);
      }
    });

  cycles
    .command('create')
    .description('Create a new cycle')
    .option('--team <team>', 'Team name or ID')
    .option('--starts-at <date>', 'Start date (YYYY-MM-DD)')
    .option('--ends-at <date>', 'End date (YYYY-MM-DD)')
    .option('--name <name>', 'Cycle name')
    .option('--description <desc>', 'Cycle description')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .option('-y, --no-interactive', 'Disable interactive prompts')
    .action(async (options: CycleCreateOptions & { startsAt?: string; endsAt?: string }) => {
      try {
        const client = getClient();
        const interactive = isInteractiveMode(options);

        let teamId: string;
        let startsAt = options.startsAt;
        let endsAt = options.endsAt;
        let name = options.name;
        let description = options.description;

        // Get team (required)
        const teamFilter = options.team || getDefaultTeam();
        if (teamFilter) {
          teamId = await resolveTeamId(teamFilter);
        } else if (interactive) {
          teamId = await promptForTeam('Select team:');
        } else {
          error('Team is required. Use --team or set a default team.');
          process.exit(1);
        }

        // Get start date (required)
        if (!startsAt) {
          if (interactive) {
            const defaultStart = getNextMonday();
            startsAt = await promptForDate('Enter start date (YYYY-MM-DD):', defaultStart);
          } else {
            error('Start date is required. Use --starts-at to specify.');
            process.exit(1);
          }
        }

        // Get end date (required)
        if (!endsAt) {
          if (interactive) {
            const defaultEnd = getTwoWeeksLater(startsAt!);
            endsAt = await promptForDate('Enter end date (YYYY-MM-DD):', defaultEnd);
          } else {
            error('End date is required. Use --ends-at to specify.');
            process.exit(1);
          }
        }

        // Interactive prompts for optional fields
        if (interactive && !options.name && !options.description) {
          const setAdditional = await promptForConfirm('Set additional fields?', false);

          if (setAdditional) {
            // Name
            name = await promptForText('Enter cycle name (optional):');

            // Description
            description = await promptForDescription();
          }
        }

        const input: LinearDocument.CycleCreateInput = {
          teamId,
          startsAt: new Date(startsAt!),
          endsAt: new Date(endsAt!)
        };

        if (name) {
          input.name = name;
        }

        if (description) {
          input.description = description;
        }

        const result = await client.createCycle(input);

        if (!result.success) {
          error('Failed to create cycle');
          process.exit(1);
        }

        const cycle = await result.cycle;

        if (options.json) {
          outputJson({
            success: true,
            cycle: {
              id: cycle?.id,
              number: cycle?.number,
              name: cycle?.name
            }
          });
        } else {
          success(`Created cycle ${cycle?.number}${cycle?.name ? `: ${cycle.name}` : ''}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to create cycle');
        process.exit(1);
      }
    });

  cycles
    .command('current')
    .description('Show the current active cycle')
    .option('--team <team>', 'Team name or ID')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions & { team?: string }) => {
      try {
        const client = getClient();
        const teamFilter = options.team || getDefaultTeam();

        if (!teamFilter) {
          error('Team is required. Use --team or set a default team.');
          process.exit(1);
        }

        const teamId = await resolveTeamId(teamFilter);
        const team = await client.team(teamId);
        const activeCycle = await team.activeCycle;

        if (!activeCycle) {
          if (options.json) {
            outputJson({ active: false, cycle: null });
          } else {
            console.log('No active cycle for this team.');
          }
          return;
        }

        const issues = await activeCycle.issues();

        if (options.json) {
          outputJson({
            active: true,
            cycle: {
              id: activeCycle.id,
              number: activeCycle.number,
              name: activeCycle.name,
              startsAt: activeCycle.startsAt,
              endsAt: activeCycle.endsAt,
              progress: activeCycle.progress,
              issueCount: issues.nodes.length
            }
          });
          return;
        }

        const progressPct = Math.round((activeCycle.progress || 0) * 100);
        console.log();
        outputDetail({
          'Number': activeCycle.number.toString(),
          'Name': activeCycle.name || '-',
          'Progress': `${progressPct}%`,
          'Issues': issues.nodes.length.toString(),
          'Start Date': formatDate(activeCycle.startsAt),
          'End Date': formatDate(activeCycle.endsAt)
        }, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to get current cycle');
        process.exit(1);
      }
    });

  return cycles;
}
