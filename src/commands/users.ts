import { Command } from '@naerth/commander-autocomplete';
import { getClient, resolveUserId } from '../client.js';
import { outputJson, outputTable, outputDetail, formatDate, success, error } from '../output.js';
import type { GlobalOptions } from '../types/index.js';

export function createUserCommands(): Command {
  const users = new Command('users')
    .alias('user')
    .alias('u')
    .description('Manage users');

  users
    .command('list')
    .alias('ls')
    .description('List organization users')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions) => {
      try {
        const client = getClient();
        const users = await client.users();

        if (options.json) {
          const usersData = users.nodes.map(user => ({
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            email: user.email,
            active: user.active,
            admin: user.admin,
            guest: user.guest,
            createdAt: user.createdAt
          }));
          outputJson(usersData);
          return;
        }

        const rows = users.nodes.map(user => [
          user.name,
          user.displayName,
          user.email || '-',
          user.active ? 'Active' : 'Inactive',
          user.admin ? 'Yes' : 'No'
        ]);

        outputTable(['Name', 'Display Name', 'Email', 'Status', 'Admin'], rows, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list users');
        process.exit(1);
      }
    });

  users
    .command('view <id>')
    .alias('show')
    .description('View user details')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const userId = await resolveUserId(id);
        const user = await client.user(userId);

        const teams = await user.teams();
        const assignedIssues = await user.assignedIssues({ first: 10 });

        if (options.json) {
          outputJson({
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            email: user.email,
            active: user.active,
            admin: user.admin,
            guest: user.guest,
            timezone: user.timezone,
            teams: teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key })),
            recentAssignedIssues: assignedIssues.nodes.map(i => ({
              id: i.id,
              identifier: i.identifier,
              title: i.title
            })),
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt
          });
          return;
        }

        console.log();
        outputDetail({
          'Name': user.name,
          'Display Name': user.displayName,
          'Email': user.email || '-',
          'Status': user.active ? 'Active' : 'Inactive',
          'Admin': user.admin ? 'Yes' : 'No',
          'Guest': user.guest ? 'Yes' : 'No',
          'Timezone': user.timezone || '-',
          'Teams': teams.nodes.map(t => t.name).join(', ') || '-',
          'Created': formatDate(user.createdAt)
        }, options);

        if (assignedIssues.nodes.length > 0) {
          console.log('\nRecent Assigned Issues:');
          for (const issue of assignedIssues.nodes) {
            console.log(`  ${issue.identifier}: ${issue.title}`);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to view user');
        process.exit(1);
      }
    });

  users
    .command('me')
    .description('Show current authenticated user')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions) => {
      try {
        const client = getClient();
        const viewer = await client.viewer;

        const teams = await viewer.teams();
        const assignedIssues = await viewer.assignedIssues({ first: 10 });
        const org = await viewer.organization;

        if (options.json) {
          outputJson({
            id: viewer.id,
            name: viewer.name,
            displayName: viewer.displayName,
            email: viewer.email,
            active: viewer.active,
            admin: viewer.admin,
            timezone: viewer.timezone,
            organization: org ? { id: org.id, name: org.name } : null,
            teams: teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key })),
            assignedIssueCount: assignedIssues.nodes.length,
            avatarUrl: viewer.avatarUrl,
            createdAt: viewer.createdAt
          });
          return;
        }

        console.log();
        outputDetail({
          'Name': viewer.name,
          'Display Name': viewer.displayName,
          'Email': viewer.email || '-',
          'Organization': org?.name || '-',
          'Status': viewer.active ? 'Active' : 'Inactive',
          'Admin': viewer.admin ? 'Yes' : 'No',
          'Timezone': viewer.timezone || '-',
          'Teams': teams.nodes.map(t => t.name).join(', ') || '-',
          'Assigned Issues': assignedIssues.nodes.length.toString(),
          'Created': formatDate(viewer.createdAt)
        }, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to get current user');
        process.exit(1);
      }
    });

  return users;
}
