import { Command } from '@naerth/commander-autocomplete';
import inquirer from 'inquirer';
import { LinearDocument } from '@linear/sdk';
import { getClient, resolveIssueId, resolveTeamId, resolveProjectId, resolveUserId, resolveStateId, resolveLabelIds } from '../client.js';
import { getDefaultTeam } from '../config.js';
import { outputJson, outputTable, outputDetail, formatPriority, formatState, formatDate, success, error } from '../output.js';
import {
  isInteractiveMode,
  promptForTeam,
  promptForText,
  promptForConfirm,
  promptForState,
  promptForPriority,
  promptForUser,
  promptForProject,
  promptForLabels,
  promptForDescription
} from '../prompts.js';
import type { IssueListOptions, IssueCreateOptions, IssueUpdateOptions, CommentCreateOptions, GlobalOptions } from '../types/index.js';

export function createIssueCommands(): Command {
  const issues = new Command('issues')
    .alias('issue')
    .alias('i')
    .description('Manage issues');

  issues
    .command('list')
    .alias('ls')
    .description('List issues')
    .option('--team <team>', 'Filter by team name or ID')
    .option('--state <state>', 'Filter by workflow state')
    .option('--assignee <user>', 'Filter by assignee')
    .option('--project <project>', 'Filter by project')
    .option('--limit <n>', 'Maximum number of issues to return', '50')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options: IssueListOptions & { limit: string }) => {
      try {
        const client = getClient();
        const teamFilter = options.team || getDefaultTeam();

        let filter: Record<string, unknown> = {};

        if (teamFilter) {
          const teamId = await resolveTeamId(teamFilter);
          filter.team = { id: { eq: teamId } };
        }

        if (options.state) {
          const stateId = await resolveStateId(options.state);
          filter.state = { id: { eq: stateId } };
        }

        if (options.assignee) {
          const userId = await resolveUserId(options.assignee);
          filter.assignee = { id: { eq: userId } };
        }

        if (options.project) {
          const projectId = await resolveProjectId(options.project);
          filter.project = { id: { eq: projectId } };
        }

        const issues = await client.issues({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: parseInt(options.limit, 10)
        });

        if (options.json) {
          const issuesData = await Promise.all(
            issues.nodes.map(async (issue) => {
              const state = await issue.state;
              const assignee = await issue.assignee;
              const team = await issue.team;
              return {
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                state: state ? { name: state.name, color: state.color } : null,
                priority: issue.priority,
                assignee: assignee ? { name: assignee.name, email: assignee.email } : null,
                team: team ? { name: team.name, key: team.key } : null,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt
              };
            })
          );
          outputJson(issuesData);
          return;
        }

        const rows = await Promise.all(
          issues.nodes.map(async (issue) => {
            const state = await issue.state;
            const assignee = await issue.assignee;
            return [
              issue.identifier,
              issue.title.substring(0, 50) + (issue.title.length > 50 ? '...' : ''),
              state ? formatState(state, options.noColor) : '-',
              formatPriority(issue.priority, options.noColor),
              assignee?.name || '-'
            ];
          })
        );

        outputTable(['ID', 'Title', 'State', 'Priority', 'Assignee'], rows, options);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list issues');
        process.exit(1);
      }
    });

  issues
    .command('view <id>')
    .alias('show')
    .description('View issue details')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const issue = await client.issue(id);

        const state = await issue.state;
        const assignee = await issue.assignee;
        const creator = await issue.creator;
        const team = await issue.team;
        const project = await issue.project;
        const labels = await issue.labels();
        const parent = await issue.parent;

        if (options.json) {
          outputJson({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            state: state ? { name: state.name, color: state.color } : null,
            priority: issue.priority,
            estimate: issue.estimate,
            assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
            creator: creator ? { id: creator.id, name: creator.name } : null,
            team: team ? { id: team.id, name: team.name, key: team.key } : null,
            project: project ? { id: project.id, name: project.name } : null,
            labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
            parent: parent ? { id: parent.id, identifier: parent.identifier } : null,
            url: issue.url,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            dueDate: issue.dueDate
          });
          return;
        }

        console.log();
        outputDetail({
          'Identifier': issue.identifier,
          'Title': issue.title,
          'State': state ? formatState(state, options.noColor) : '-',
          'Priority': formatPriority(issue.priority, options.noColor),
          'Estimate': issue.estimate?.toString() || '-',
          'Team': team?.name || '-',
          'Project': project?.name || '-',
          'Assignee': assignee?.name || '-',
          'Creator': creator?.name || '-',
          'Labels': labels.nodes.map(l => l.name).join(', ') || '-',
          'Parent': parent?.identifier || '-',
          'Due Date': formatDate(issue.dueDate),
          'Created': formatDate(issue.createdAt),
          'Updated': formatDate(issue.updatedAt),
          'URL': issue.url
        }, options);

        if (issue.description) {
          console.log('\nDescription:');
          console.log(issue.description);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to view issue');
        process.exit(1);
      }
    });

  issues
    .command('create')
    .description('Create a new issue')
    .option('--title <title>', 'Issue title')
    .option('--description <desc>', 'Issue description')
    .option('--team <team>', 'Team name or ID')
    .option('--state <state>', 'Workflow state')
    .option('--assignee <user>', 'Assignee name or ID')
    .option('--project <project>', 'Project name or ID')
    .option('--priority <n>', 'Priority (0-4)', '0')
    .option('--labels <labels>', 'Comma-separated label names')
    .option('--estimate <n>', 'Estimate points')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .option('-y, --no-interactive', 'Disable interactive prompts')
    .action(async (options: IssueCreateOptions & { labels?: string; priority: string; estimate?: string }) => {
      try {
        const client = getClient();
        const interactive = isInteractiveMode(options);

        let teamId: string;
        let title = options.title;
        let description = options.description;
        let stateId: string | undefined;
        let assigneeId: string | undefined;
        let projectId: string | undefined;
        let priority = parseInt(options.priority, 10);
        let labelIds: string[] | undefined;
        let estimate: number | undefined = options.estimate ? parseInt(options.estimate, 10) : undefined;

        // Resolve team first (required)
        const teamFilter = options.team || getDefaultTeam();
        if (teamFilter) {
          teamId = await resolveTeamId(teamFilter);
        } else if (interactive) {
          teamId = await promptForTeam('Select team:');
        } else {
          error('Team is required. Use --team or set a default team.');
          process.exit(1);
        }

        // Get title (required)
        if (!title) {
          if (interactive) {
            title = await promptForText('Enter issue title:', { required: true });
          } else {
            error('Title is required. Use --title to specify.');
            process.exit(1);
          }
        }

        // Resolve provided options
        if (options.state) {
          stateId = await resolveStateId(options.state, teamId);
        }

        if (options.assignee) {
          assigneeId = await resolveUserId(options.assignee);
        }

        if (options.project) {
          projectId = await resolveProjectId(options.project);
        }

        if (options.labels) {
          const labelNames = options.labels.split(',').map(l => l.trim());
          labelIds = await resolveLabelIds(labelNames, teamId);
        }

        // Interactive prompts for optional fields
        if (interactive && !options.state && !options.assignee && !options.project && !options.labels && !options.description) {
          const setAdditional = await promptForConfirm('Set additional fields?', false);

          if (setAdditional) {
            // State
            stateId = await promptForState(teamId, 'Select state:');

            // Priority
            priority = await promptForPriority('Select priority:');

            // Assignee
            assigneeId = await promptForUser('Select assignee:');

            // Project
            projectId = await promptForProject('Select project:');

            // Labels
            labelIds = await promptForLabels(teamId, 'Select labels:');

            // Description
            const addDesc = await promptForConfirm('Add description?', false);
            if (addDesc) {
              description = await promptForDescription('Enter description:');
            }
          }
        }

        const input: LinearDocument.IssueCreateInput = {
          title: title!,
          teamId,
          priority
        };

        if (description) {
          input.description = description;
        }

        if (stateId) {
          input.stateId = stateId;
        }

        if (assigneeId) {
          input.assigneeId = assigneeId;
        }

        if (projectId) {
          input.projectId = projectId;
        }

        if (labelIds && labelIds.length > 0) {
          input.labelIds = labelIds;
        }

        if (estimate !== undefined) {
          input.estimate = estimate;
        }

        const result = await client.createIssue(input);

        if (!result.success) {
          error('Failed to create issue');
          process.exit(1);
        }

        const issue = await result.issue;

        if (options.json) {
          outputJson({
            success: true,
            issue: {
              id: issue?.id,
              identifier: issue?.identifier,
              title: issue?.title,
              url: issue?.url
            }
          });
        } else {
          success(`Created issue ${issue?.identifier}: ${issue?.title}`);
          console.log(`URL: ${issue?.url}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to create issue');
        process.exit(1);
      }
    });

  issues
    .command('update <id>')
    .description('Update an existing issue')
    .option('--title <title>', 'New title')
    .option('--description <desc>', 'New description')
    .option('--state <state>', 'New workflow state')
    .option('--assignee <user>', 'New assignee')
    .option('--project <project>', 'New project')
    .option('--priority <n>', 'New priority (0-4)')
    .option('--labels <labels>', 'Comma-separated label names (replaces existing)')
    .option('--estimate <n>', 'New estimate points')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .option('-y, --no-interactive', 'Disable interactive prompts')
    .action(async (id: string, options: IssueUpdateOptions & { labels?: string; priority?: string; estimate?: string }) => {
      try {
        const client = getClient();
        const issueId = await resolveIssueId(id);
        const interactive = isInteractiveMode(options);

        const input: Record<string, unknown> = {};

        // Check if any update flags were provided
        const hasUpdateFlags = options.title || options.description || options.state ||
          options.assignee || options.project || options.priority || options.labels || options.estimate;

        if (!hasUpdateFlags && interactive) {
          // Fetch current issue to show defaults
          const currentIssue = await client.issue(issueId);
          const currentTeam = await currentIssue.team;
          const teamId = currentTeam?.id;

          // Ask what to update
          const updateChoices = [
            { name: 'Title', value: 'title' },
            { name: 'Description', value: 'description' },
            { name: 'State', value: 'state' },
            { name: 'Priority', value: 'priority' },
            { name: 'Assignee', value: 'assignee' },
            { name: 'Project', value: 'project' },
            { name: 'Labels', value: 'labels' }
          ];

          const { fieldsToUpdate } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'fieldsToUpdate',
              message: 'What would you like to update?',
              choices: updateChoices
            }
          ]);

          if (fieldsToUpdate.length === 0) {
            error('No updates selected');
            process.exit(1);
          }

          for (const field of fieldsToUpdate as string[]) {
            switch (field) {
              case 'title':
                input.title = await promptForText('Enter new title:', {
                  default: currentIssue.title,
                  required: true
                });
                break;
              case 'description':
                input.description = await promptForDescription('Enter new description:');
                break;
              case 'state':
                const newStateId = await promptForState(teamId, 'Select new state:');
                if (newStateId) input.stateId = newStateId;
                break;
              case 'priority':
                input.priority = await promptForPriority('Select new priority:');
                break;
              case 'assignee':
                const newAssigneeId = await promptForUser('Select new assignee:');
                if (newAssigneeId) input.assigneeId = newAssigneeId;
                break;
              case 'project':
                const newProjectId = await promptForProject('Select new project:');
                if (newProjectId) input.projectId = newProjectId;
                break;
              case 'labels':
                const newLabelIds = await promptForLabels(teamId, 'Select labels:');
                if (newLabelIds.length > 0) input.labelIds = newLabelIds;
                break;
            }
          }
        } else {
          // Process provided flags
          if (options.title) input.title = options.title;
          if (options.description) input.description = options.description;
          if (options.priority) input.priority = parseInt(options.priority, 10);
          if (options.estimate) input.estimate = parseInt(options.estimate, 10);

          if (options.state) {
            input.stateId = await resolveStateId(options.state);
          }

          if (options.assignee) {
            input.assigneeId = await resolveUserId(options.assignee);
          }

          if (options.project) {
            input.projectId = await resolveProjectId(options.project);
          }

          if (options.labels) {
            const labelNames = options.labels.split(',').map(l => l.trim());
            input.labelIds = await resolveLabelIds(labelNames);
          }
        }

        if (Object.keys(input).length === 0) {
          error('No updates specified');
          process.exit(1);
        }

        const result = await client.updateIssue(issueId, input);

        if (!result.success) {
          error('Failed to update issue');
          process.exit(1);
        }

        const issue = await result.issue;

        if (options.json) {
          outputJson({
            success: true,
            issue: {
              id: issue?.id,
              identifier: issue?.identifier,
              title: issue?.title
            }
          });
        } else {
          success(`Updated issue ${issue?.identifier}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to update issue');
        process.exit(1);
      }
    });

  issues
    .command('delete <id>')
    .alias('archive')
    .description('Archive an issue')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const issueId = await resolveIssueId(id);

        const result = await client.archiveIssue(issueId);

        if (!result.success) {
          error('Failed to archive issue');
          process.exit(1);
        }

        if (options.json) {
          outputJson({ success: true, archived: true });
        } else {
          success(`Archived issue ${id}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to archive issue');
        process.exit(1);
      }
    });

  issues
    .command('comment <id>')
    .description('Add a comment to an issue')
    .option('--body <body>', 'Comment body (or enter interactively)')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: CommentCreateOptions & { body?: string }) => {
      try {
        const client = getClient();
        const issueId = await resolveIssueId(id);

        let body = options.body;

        if (!body) {
          const answers = await inquirer.prompt([
            {
              type: 'editor',
              name: 'body',
              message: 'Enter comment:',
              validate: (input: string) => input.length > 0 || 'Comment body is required'
            }
          ]);
          body = answers.body;
        }

        const result = await client.createComment({
          issueId,
          body: body!
        });

        if (!result.success) {
          error('Failed to add comment');
          process.exit(1);
        }

        const comment = await result.comment;

        if (options.json) {
          outputJson({
            success: true,
            comment: {
              id: comment?.id,
              body: comment?.body
            }
          });
        } else {
          success('Comment added successfully');
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to add comment');
        process.exit(1);
      }
    });

  issues
    .command('comments <id>')
    .description('List comments on an issue')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (id: string, options: GlobalOptions) => {
      try {
        const client = getClient();
        const issue = await client.issue(id);
        const comments = await issue.comments();

        if (options.json) {
          const commentsData = await Promise.all(
            comments.nodes.map(async (c) => {
              const user = await c.user;
              return {
                id: c.id,
                body: c.body,
                user: user ? { name: user.name } : null,
                createdAt: c.createdAt
              };
            })
          );
          outputJson(commentsData);
          return;
        }

        if (comments.nodes.length === 0) {
          console.log('No comments on this issue.');
          return;
        }

        for (const comment of comments.nodes) {
          const user = await comment.user;
          console.log(`\n--- ${user?.name || 'Unknown'} (${formatDate(comment.createdAt)}) ---`);
          console.log(comment.body);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list comments');
        process.exit(1);
      }
    });

  return issues;
}
