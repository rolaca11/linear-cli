import { LinearClient, WorkflowState } from '@linear/sdk';
import { getAccessToken, getOAuthTokens, getAuthMethod, updateOAuthTokens, getOAuthAppConfig, getApiKey } from './config.js';
import { refreshAccessToken, isTokenExpired } from './oauth.js';

let clientInstance: LinearClient | null = null;

function createLinearClient(token: string, method: 'apikey' | 'oauth' | undefined): LinearClient {
  // API keys use 'apiKey' parameter, OAuth tokens use 'accessToken'
  if (method === 'oauth') {
    return new LinearClient({ accessToken: token });
  }
  // Default to apiKey for backwards compatibility
  return new LinearClient({ apiKey: token });
}

async function ensureValidToken(): Promise<string> {
  const method = getAuthMethod();

  if (method === 'apikey') {
    const apiKey = getAccessToken();
    if (!apiKey) {
      throw new Error('Not authenticated. Run "linear auth login" first.');
    }
    return apiKey;
  }

  if (method === 'oauth') {
    const tokens = getOAuthTokens();
    if (!tokens) {
      throw new Error('Not authenticated. Run "linear auth login" first.');
    }

    // Check if token is expired and refresh if needed
    if (isTokenExpired(tokens.expiresAt) && tokens.refreshToken) {
      const appConfig = getOAuthAppConfig();
      if (!appConfig?.clientId) {
        throw new Error('OAuth app not configured. Please run "linear auth login --oauth" again.');
      }
      try {
        console.error('Access token expired, refreshing...');
        const newTokens = await refreshAccessToken(tokens.refreshToken, appConfig.clientId, appConfig.clientSecret);
        updateOAuthTokens(newTokens);
        return newTokens.accessToken;
      } catch (err) {
        throw new Error('Failed to refresh access token. Please run "linear auth login" again.');
      }
    }

    return tokens.accessToken;
  }

  // Fallback
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Run "linear auth login" first.');
  }
  return token;
}

export async function getClientAsync(): Promise<LinearClient> {
  const accessToken = await ensureValidToken();
  const method = getAuthMethod();

  // Reset client if token changed
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = createLinearClient(accessToken, method);
  return clientInstance;
}

export function getClient(): LinearClient {
  const token = getAccessToken();
  const method = getAuthMethod();

  if (!token) {
    console.error('Error: Not authenticated. Run "linear auth login" first.');
    process.exit(1);
  }

  if (!clientInstance) {
    clientInstance = createLinearClient(token, method);
  }

  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}

export async function resolveIssueId(identifier: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return identifier;
  }

  // Otherwise, search by identifier (e.g., TECH-747)
  const issue = await client.issue(identifier);
  return issue.id;
}

export async function resolveTeamId(teamNameOrId: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (teamNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return teamNameOrId;
  }

  // Search by name or key
  const teams = await client.teams();
  const team = teams.nodes.find(
    t => t.name.toLowerCase() === teamNameOrId.toLowerCase() ||
         t.key.toLowerCase() === teamNameOrId.toLowerCase()
  );

  if (!team) {
    throw new Error(`Team not found: ${teamNameOrId}`);
  }

  return team.id;
}

export async function resolveProjectId(projectNameOrId: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (projectNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return projectNameOrId;
  }

  // Search by name
  const projects = await client.projects();
  const project = projects.nodes.find(
    p => p.name.toLowerCase() === projectNameOrId.toLowerCase()
  );

  if (!project) {
    throw new Error(`Project not found: ${projectNameOrId}`);
  }

  return project.id;
}

export async function resolveUserId(userNameOrId: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (userNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return userNameOrId;
  }

  // Handle special "me" case
  if (userNameOrId.toLowerCase() === 'me') {
    const viewer = await client.viewer;
    return viewer.id;
  }

  // Search by name or email
  const users = await client.users();
  const user = users.nodes.find(
    u => u.name.toLowerCase() === userNameOrId.toLowerCase() ||
         u.email?.toLowerCase() === userNameOrId.toLowerCase() ||
         u.displayName.toLowerCase() === userNameOrId.toLowerCase()
  );

  if (!user) {
    throw new Error(`User not found: ${userNameOrId}`);
  }

  return user.id;
}

export async function resolveStateId(stateNameOrId: string, teamId?: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (stateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return stateNameOrId;
  }

  // Search by name
  const states = await client.workflowStates();
  let filteredStates = states.nodes;

  if (teamId) {
    filteredStates = await Promise.all(
      filteredStates.map(async (s) => {
        const team = await s.team;
        return team?.id === teamId ? s : null;
      })
    ).then(results => results.filter((s): s is WorkflowState => s !== null));
  }

  const state = filteredStates.find(
    s => s.name.toLowerCase() === stateNameOrId.toLowerCase()
  );

  if (!state) {
    throw new Error(`Workflow state not found: ${stateNameOrId}`);
  }

  return state.id;
}

export async function resolveLabelIds(labelNames: string[], teamId?: string): Promise<string[]> {
  const client = getClient();
  const labels = await client.issueLabels();

  const ids: string[] = [];

  for (const name of labelNames) {
    // If it looks like a UUID, use as-is
    if (name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      ids.push(name);
      continue;
    }

    const label = labels.nodes.find(
      l => l.name.toLowerCase() === name.toLowerCase()
    );

    if (!label) {
      throw new Error(`Label not found: ${name}`);
    }

    ids.push(label.id);
  }

  return ids;
}

export async function resolveCycleId(cycleNameOrId: string): Promise<string> {
  const client = getClient();

  // If it looks like a UUID, return as-is
  if (cycleNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return cycleNameOrId;
  }

  // Search by name or number
  const cycles = await client.cycles();
  const cycle = cycles.nodes.find(
    c => c.name?.toLowerCase() === cycleNameOrId.toLowerCase() ||
         c.number.toString() === cycleNameOrId
  );

  if (!cycle) {
    throw new Error(`Cycle not found: ${cycleNameOrId}`);
  }

  return cycle.id;
}
