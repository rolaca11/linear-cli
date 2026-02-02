import { Command } from 'commander';
import { LinearDocument } from '@linear/sdk';
import { getClient, resolveProjectId, resolveTeamId, resolveUserId } from '../client.js';
import { outputJson, outputTable, outputDetail, formatDate, success, error } from '../output.js';
import type { ProjectCreateOptions, ProjectUpdateOptions, GlobalOptions } from '../types/index.js';

export function createProjectCommands(): Command {
  const projects = new Command('projects')
    .alias('project')
    .alias('p')
    .description('Manage projects');

  projects
    .command('list')
    .alias('ls')
    .description('List projects')
    .option('--team <team>', 'Filter by team')
    .option('--limit <n>', 'Maximum number of projects', '50')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: GlobalOptions & { team?: string; limit: string }) => {
      try {
        const client = getClient();

        let filter: Record<string, unknown> = {};

        if (options.team) {
          const teamId = await resolveTeamId(options.team);
          filter.accessibleTeams = { id: { eq: teamId } };
        }

        const projects = await client.projects({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: parseInt(options.limit, 10)
        });

        if (options.json) {
          const projectsData = await Promise.all(
            projects.nodes.map(async (project) => {
              const lead = await project.lead;
              return {
                id: project.id,
                name: project.name,
                description: project.description,
                state: project.state,
                progress: project.progress,
                lead: lead ? { name: lead.name } : null,
                targetDate: project.targetDate,
                createdAt: project.createdAt
              };
            })
          );
          outputJson(projectsData);
          return;
        }

        const rows = await Promise.all(
          projects.nodes.map(async (project) => {
            const lead = await project.lead;
            const progressPct = Math.round((project.progress || 0) * 100);
            return [
              project.name.substring(0, 40) + (project.name.length > 40 ? '...' : ''),
              project.state || '-',
              `${progressPct}%`,
              lead?.name || '-',
              formatDate(project.targetDate)
            ];
          })
        );

        outputTable(['Name', 'State', 'Progress', 'Lead', 'Target Date'], rows, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list projects');
        process.exit(1);
      }
    });

  projects
    .command('view <id>')
    .alias('show')
    .description('View project details')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const projectId = await resolveProjectId(id);
        const project = await client.project(projectId);

        const lead = await project.lead;
        const teams = await project.teams();
        const issues = await project.issues();

        if (options.json) {
          outputJson({
            id: project.id,
            name: project.name,
            description: project.description,
            state: project.state,
            progress: project.progress,
            lead: lead ? { id: lead.id, name: lead.name } : null,
            teams: teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key })),
            issueCount: issues.nodes.length,
            url: project.url,
            targetDate: project.targetDate,
            startDate: project.startDate,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          });
          return;
        }

        console.log();
        const progressPct = Math.round((project.progress || 0) * 100);
        outputDetail({
          'Name': project.name,
          'State': project.state || '-',
          'Progress': `${progressPct}%`,
          'Lead': lead?.name || '-',
          'Teams': teams.nodes.map(t => t.name).join(', ') || '-',
          'Issues': issues.nodes.length.toString(),
          'Start Date': formatDate(project.startDate),
          'Target Date': formatDate(project.targetDate),
          'Created': formatDate(project.createdAt),
          'URL': project.url
        }, options);

        if (project.description) {
          console.log('\nDescription:');
          console.log(project.description);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to view project');
        process.exit(1);
      }
    });

  projects
    .command('create')
    .description('Create a new project')
    .requiredOption('--name <name>', 'Project name')
    .option('--description <desc>', 'Project description (max 255 chars)')
    .option('--teams <teams>', 'Comma-separated team names or IDs')
    .option('--lead <user>', 'Project lead')
    .option('--target-date <date>', 'Target date (YYYY-MM-DD)')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: ProjectCreateOptions & { teams?: string; targetDate?: string }) => {
      try {
        const client = getClient();

        // Resolve team IDs first
        let teamIds: string[] = [];
        if (options.teams) {
          const teamNames = options.teams.split(',').map(t => t.trim());
          teamIds = await Promise.all(teamNames.map(t => resolveTeamId(t)));
        }

        const input: LinearDocument.ProjectCreateInput = {
          name: options.name,
          teamIds
        };

        if (options.description) {
          input.description = options.description.substring(0, 255);
        }

        if (options.lead) {
          input.leadId = await resolveUserId(options.lead);
        }

        if (options.targetDate) {
          input.targetDate = options.targetDate;
        }

        const result = await client.createProject(input);

        if (!result.success) {
          error('Failed to create project');
          process.exit(1);
        }

        const project = await result.project;

        if (options.json) {
          outputJson({
            success: true,
            project: {
              id: project?.id,
              name: project?.name,
              url: project?.url
            }
          });
        } else {
          success(`Created project: ${project?.name}`);
          console.log(`URL: ${project?.url}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to create project');
        process.exit(1);
      }
    });

  projects
    .command('update <id>')
    .description('Update a project')
    .option('--name <name>', 'New name')
    .option('--description <desc>', 'New description')
    .option('--lead <user>', 'New lead')
    .option('--target-date <date>', 'New target date')
    .option('--state <state>', 'New state (planned, started, paused, completed, canceled)')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: ProjectUpdateOptions & { targetDate?: string }) => {
      try {
        const client = getClient();
        const projectId = await resolveProjectId(id);

        const input: Record<string, unknown> = {};

        if (options.name) input.name = options.name;
        if (options.description) input.description = options.description.substring(0, 255);
        if (options.state) input.state = options.state;
        if (options.targetDate) input.targetDate = options.targetDate;

        if (options.lead) {
          input.leadId = await resolveUserId(options.lead);
        }

        if (Object.keys(input).length === 0) {
          error('No updates specified');
          process.exit(1);
        }

        const result = await client.updateProject(projectId, input);

        if (!result.success) {
          error('Failed to update project');
          process.exit(1);
        }

        const project = await result.project;

        if (options.json) {
          outputJson({
            success: true,
            project: {
              id: project?.id,
              name: project?.name
            }
          });
        } else {
          success(`Updated project: ${project?.name}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to update project');
        process.exit(1);
      }
    });

  return projects;
}
