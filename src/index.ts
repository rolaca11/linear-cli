#!/usr/bin/env node

import { Command } from '@naerth/commander-autocomplete';
import { createAuthCommands } from './commands/auth.js';
import { createIssueCommands } from './commands/issues.js';
import { createProjectCommands } from './commands/projects.js';
import { createTeamCommands } from './commands/teams.js';
import { createCycleCommands } from './commands/cycles.js';
import { createLabelCommands } from './commands/labels.js';
import { createUserCommands } from './commands/users.js';
import { createStateCommands } from './commands/states.js';
import { createSkillCommand } from './commands/skill.js';

const program = new Command();

program
  .name('linear')
  .description('CLI tool for interfacing with the Linear API')
  .version('1.0.0')
  .option('-y, --no-interactive', 'Disable interactive prompts (for scripting/CI)');

// Add all command groups
program.addCommand(createAuthCommands());
program.addCommand(createIssueCommands());
program.addCommand(createProjectCommands());
program.addCommand(createTeamCommands());
program.addCommand(createCycleCommands());
program.addCommand(createLabelCommands());
program.addCommand(createUserCommands());
program.addCommand(createStateCommands());
program.addCommand(createSkillCommand());

// Add helpful examples
program.addHelpText('after', `

Examples:
  $ linear auth login                         Authenticate (interactive)
  $ linear auth login --oauth                 Authenticate via OAuth (browser)
  $ linear auth login --key <key>             Authenticate with API key
  $ linear auth status                        Check authentication status
  $ linear auth refresh                       Refresh OAuth token

  $ linear issues list --team TECH            List issues for a team
  $ linear issues view TECH-747               View issue details
  $ linear issues create --title "Bug" --team TECH
                                              Create a new issue
  $ linear issues update TECH-747 --state "In Progress"
                                              Update an issue
  $ linear issues comment TECH-747            Add a comment to an issue

  $ linear projects list                      List all projects
  $ linear projects create --name "Q1 Launch" --teams TECH,DESIGN
                                              Create a new project

  $ linear teams list                         List all teams
  $ linear cycles current --team TECH         Show current cycle
  $ linear users me                           Show current user info

Environment Variables:
  LINEAR_API_KEY       API key (overrides stored credentials)
  LINEAR_ACCESS_TOKEN  OAuth access token (overrides stored credentials)
`);

program.parse();
