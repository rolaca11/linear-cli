import { Command } from '@naerth/commander-autocomplete';
import { spawn } from 'child_process';
import { info } from '../output.js';

const SKILL_REPO = 'rolaca11/linear-cli';

function runNpxSkills(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['skills', ...args], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npx skills exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('Manage Linear CLI agent skill (wrapper for npx skills)');

  skill
    .command('install')
    .description('Install the Linear CLI skill for AI coding agents')
    .option('-a, --agent <agents...>', 'Target agents (e.g., claude-code, cursor)')
    .option('-g, --global', 'Install to user directory instead of project')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options: { agent?: string[]; global?: boolean; yes?: boolean }) => {
      const args = ['add', SKILL_REPO];

      if (options.agent) {
        for (const agent of options.agent) {
          args.push('-a', agent);
        }
      }

      if (options.global) {
        args.push('--global');
      }

      if (options.yes) {
        args.push('--yes');
      }

      info(`Running: npx skills ${args.join(' ')}`);
      await runNpxSkills(args);
    });

  skill
    .command('uninstall')
    .alias('remove')
    .description('Uninstall the Linear CLI skill')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options: { yes?: boolean }) => {
      const args = ['remove', 'linear-cli'];

      if (options.yes) {
        args.push('--yes');
      }

      info(`Running: npx skills ${args.join(' ')}`);
      await runNpxSkills(args);
    });

  skill
    .command('list')
    .description('List installed skills')
    .action(async () => {
      await runNpxSkills(['list']);
    });

  skill
    .command('update')
    .description('Update installed skills')
    .action(async () => {
      await runNpxSkills(['update']);
    });

  return skill;
}
