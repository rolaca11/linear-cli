import { Command } from '@naerth/commander-autocomplete';
import inquirer from 'inquirer';
import { LinearClient } from '@linear/sdk';
import { getAccessToken, setApiKey, clearCredentials, getConfigPath, getAuthMethod, setOAuthTokens, getOAuthTokens, getOAuthAppConfig, setOAuthAppConfig } from '../config.js';
import { startOAuthFlow, revokeToken } from '../oauth.js';
import { success, error, info, outputDetail, outputJson, warn } from '../output.js';
import type { GlobalOptions } from '../types/index.js';

const OAUTH_SETUP_URL = 'https://linear.app/settings/api/applications';

export function createAuthCommands(): Command {
  const auth = new Command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Linear')
    .option('--oauth', 'Use OAuth authentication (opens browser)')
    .option('--key <key>', 'API key (for non-interactive login)')
    .option('--client-id <id>', 'OAuth Client ID (for OAuth login)')
    .option('--client-secret <secret>', 'OAuth Client Secret (optional)')
    .action(async (options: { oauth?: boolean; key?: string; clientId?: string; clientSecret?: string } & GlobalOptions) => {
      // If --key is provided, use API key auth
      if (options.key) {
        await loginWithApiKey(options.key);
        return;
      }

      // If --oauth is provided, use OAuth
      if (options.oauth) {
        await loginWithOAuth(options.clientId, options.clientSecret);
        return;
      }

      // Otherwise, prompt for method
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'method',
          message: 'Choose authentication method:',
          choices: [
            { name: 'API Key (simpler, recommended for personal use)', value: 'apikey' },
            { name: 'OAuth (browser-based, requires OAuth app setup)', value: 'oauth' }
          ]
        }
      ]);

      if (answers.method === 'oauth') {
        await loginWithOAuth(options.clientId, options.clientSecret);
      } else {
        await promptAndLoginWithApiKey();
      }
    });

  auth
    .command('logout')
    .description('Remove stored credentials')
    .action(async (options: GlobalOptions) => {
      const method = getAuthMethod();

      // Try to revoke OAuth token if using OAuth
      if (method === 'oauth') {
        const tokens = getOAuthTokens();
        if (tokens?.accessToken) {
          try {
            await revokeToken(tokens.accessToken);
          } catch {
            // Ignore revocation errors
          }
        }
      }

      clearCredentials();
      success('Logged out successfully');
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .option('--json', 'Output as JSON')
    .action(async (options: GlobalOptions) => {
      const accessToken = getAccessToken();
      const method = getAuthMethod();

      if (!accessToken) {
        if (options.json) {
          outputJson({ authenticated: false });
        } else {
          info('Not authenticated. Run "linear auth login" to authenticate.');
        }
        return;
      }

      try {
        // Use correct parameter based on auth method
        const client = method === 'oauth'
          ? new LinearClient({ accessToken })
          : new LinearClient({ apiKey: accessToken });
        const viewer = await client.viewer;
        const org = await viewer.organization;

        if (options.json) {
          outputJson({
            authenticated: true,
            method: method || 'unknown',
            user: {
              id: viewer.id,
              name: viewer.name,
              email: viewer.email,
              displayName: viewer.displayName
            },
            organization: org ? {
              id: org.id,
              name: org.name
            } : null,
            configPath: getConfigPath()
          });
        } else {
          success('Authenticated');
          console.log();
          outputDetail({
            'Method': method === 'oauth' ? 'OAuth' : 'API Key',
            'User': viewer.name,
            'Email': viewer.email || '-',
            'Display Name': viewer.displayName,
            'User ID': viewer.id,
            'Organization': org?.name || '-',
            'Config Path': getConfigPath()
          });

          // Show token expiry for OAuth
          if (method === 'oauth') {
            const tokens = getOAuthTokens();
            if (tokens?.expiresAt) {
              const expiresIn = Math.round((tokens.expiresAt - Date.now()) / 1000 / 60);
              if (expiresIn > 0) {
                info(`Token expires in ${expiresIn} minutes`);
              } else {
                warn('Token has expired - will be refreshed on next request');
              }
            }
          }
        }
      } catch (err) {
        error('Failed to verify credentials. Your token may be invalid.');
        process.exit(1);
      }
    });

  auth
    .command('refresh')
    .description('Refresh OAuth access token')
    .action(async () => {
      const method = getAuthMethod();

      if (method !== 'oauth') {
        error('Not using OAuth authentication. Run "linear auth login --oauth" first.');
        process.exit(1);
      }

      const tokens = getOAuthTokens();
      if (!tokens?.refreshToken) {
        error('No refresh token available. Please run "linear auth login --oauth" again.');
        process.exit(1);
      }

      const appConfig = getOAuthAppConfig();
      if (!appConfig?.clientId) {
        error('OAuth app not configured. Please run "linear auth login --oauth" again.');
        process.exit(1);
      }

      try {
        const { refreshAccessToken } = await import('../oauth.js');
        const newTokens = await refreshAccessToken(tokens.refreshToken, appConfig.clientId, appConfig.clientSecret);
        setOAuthTokens(newTokens);
        success('Access token refreshed successfully');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to refresh token');
        process.exit(1);
      }
    });

  auth
    .command('setup-oauth')
    .description('Configure OAuth application credentials')
    .option('--client-id <id>', 'OAuth Client ID')
    .option('--client-secret <secret>', 'OAuth Client Secret (optional)')
    .action(async (options: { clientId?: string; clientSecret?: string }) => {
      let clientId = options.clientId;
      let clientSecret = options.clientSecret;

      if (!clientId) {
        console.log('\nTo use OAuth authentication, you need to create an OAuth application in Linear.');
        console.log(`\nVisit: ${OAUTH_SETUP_URL}\n`);
        console.log('When creating your app:');
        console.log('  - Set the Callback URL to: http://localhost:3847/callback');
        console.log('  - Enable "Public" if you want to use it across workspaces\n');

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'clientId',
            message: 'Enter your OAuth Client ID:',
            validate: (input: string) => input.length > 0 || 'Client ID is required'
          },
          {
            type: 'password',
            name: 'clientSecret',
            message: 'Enter your OAuth Client Secret (optional, press Enter to skip):',
            mask: '*'
          }
        ]);

        clientId = answers.clientId;
        clientSecret = answers.clientSecret || undefined;
      }

      setOAuthAppConfig({
        clientId: clientId!,
        clientSecret
      });

      success('OAuth application configured successfully');
      info('You can now run "linear auth login --oauth" to authenticate');
    });

  return auth;
}

async function loginWithApiKey(apiKey: string): Promise<void> {
  try {
    const client = new LinearClient({ apiKey });
    const viewer = await client.viewer;

    setApiKey(apiKey);
    success(`Authenticated as ${viewer.name} (${viewer.email})`);
    info(`Config saved to ${getConfigPath()}`);
  } catch (err) {
    error('Invalid API key. Please check your key and try again.');
    process.exit(1);
  }
}

async function promptAndLoginWithApiKey(): Promise<void> {
  console.log('\nYou can create an API key at: https://linear.app/settings/api\n');

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Linear API key:',
      mask: '*',
      validate: (input: string) => input.length > 0 || 'API key is required'
    }
  ]);

  await loginWithApiKey(answers.apiKey);
}

async function loginWithOAuth(providedClientId?: string, providedClientSecret?: string): Promise<void> {
  let clientId = providedClientId;
  let clientSecret = providedClientSecret;

  // Check if we have stored OAuth app config
  const storedConfig = getOAuthAppConfig();

  if (!clientId) {
    if (storedConfig?.clientId) {
      clientId = storedConfig.clientId;
      clientSecret = storedConfig.clientSecret;
    } else {
      // Need to set up OAuth app first
      console.log('\nOAuth authentication requires an OAuth application.');
      console.log(`\nCreate one at: ${OAUTH_SETUP_URL}\n`);
      console.log('When creating your app:');
      console.log('  - Set the Callback URL to: http://localhost:3847/callback');
      console.log('  - Enable "Public" if you want to use it across workspaces\n');

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'clientId',
          message: 'Enter your OAuth Client ID:',
          validate: (input: string) => input.length > 0 || 'Client ID is required'
        },
        {
          type: 'password',
          name: 'clientSecret',
          message: 'Enter your OAuth Client Secret (optional, press Enter to skip):',
          mask: '*'
        }
      ]);

      clientId = answers.clientId;
      clientSecret = answers.clientSecret || undefined;

      // Save the OAuth app config
      setOAuthAppConfig({
        clientId: clientId!,
        clientSecret
      });
    }
  } else {
    // Save provided credentials
    setOAuthAppConfig({
      clientId: clientId!,
      clientSecret
    });
  }

  try {
    info('Starting OAuth authentication flow...');
    const tokens = await startOAuthFlow({
      clientId: clientId!,
      clientSecret
    });

    // Validate the token
    const client = new LinearClient({ accessToken: tokens.accessToken });
    const viewer = await client.viewer;

    setOAuthTokens(tokens);
    success(`Authenticated as ${viewer.name} (${viewer.email})`);
    info(`Config saved to ${getConfigPath()}`);
  } catch (err) {
    error(err instanceof Error ? err.message : 'OAuth authentication failed');
    process.exit(1);
  }
}
