import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, OAuthTokens, OAuthAppConfig } from './types/index.js';

const CONFIG_DIR = join(homedir(), '.config', 'linear-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();

  const content = JSON.stringify(config, null, 2);
  writeFileSync(CONFIG_FILE, content, { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}

export function getApiKey(): string | undefined {
  // Environment variable takes precedence
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }

  const config = loadConfig();
  return config.apiKey;
}

export function setApiKey(apiKey: string): void {
  const config = loadConfig();
  config.apiKey = apiKey;
  config.authMethod = 'apikey';
  // Clear OAuth tokens when setting API key
  delete config.oauth;
  saveConfig(config);
}

export function clearCredentials(): void {
  const config = loadConfig();
  delete config.apiKey;
  delete config.oauth;
  delete config.authMethod;
  saveConfig(config);
}

// Legacy function for backwards compatibility
export function clearApiKey(): void {
  clearCredentials();
}

export function getOAuthTokens(): OAuthTokens | undefined {
  // Environment variable for access token
  if (process.env.LINEAR_ACCESS_TOKEN) {
    return {
      accessToken: process.env.LINEAR_ACCESS_TOKEN,
      refreshToken: process.env.LINEAR_REFRESH_TOKEN
    };
  }

  const config = loadConfig();
  return config.oauth;
}

export function setOAuthTokens(tokens: OAuthTokens): void {
  const config = loadConfig();
  config.oauth = tokens;
  config.authMethod = 'oauth';
  // Clear API key when setting OAuth
  delete config.apiKey;
  saveConfig(config);
}

export function updateOAuthTokens(tokens: Partial<OAuthTokens>): void {
  const config = loadConfig();
  if (config.oauth) {
    config.oauth = { ...config.oauth, ...tokens };
    saveConfig(config);
  }
}

export function getAuthMethod(): 'apikey' | 'oauth' | undefined {
  if (process.env.LINEAR_API_KEY) return 'apikey';
  if (process.env.LINEAR_ACCESS_TOKEN) return 'oauth';

  const config = loadConfig();
  return config.authMethod;
}

export function getAccessToken(): string | undefined {
  const method = getAuthMethod();

  if (method === 'apikey') {
    return getApiKey();
  }

  if (method === 'oauth') {
    const tokens = getOAuthTokens();
    return tokens?.accessToken;
  }

  // Fallback: check both
  const apiKey = getApiKey();
  if (apiKey) return apiKey;

  const tokens = getOAuthTokens();
  return tokens?.accessToken;
}

export function getDefaultTeam(): string | undefined {
  const config = loadConfig();
  return config.defaultTeam;
}

export function setDefaultTeam(team: string): void {
  const config = loadConfig();
  config.defaultTeam = team;
  saveConfig(config);
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function getOAuthAppConfig(): OAuthAppConfig | undefined {
  const config = loadConfig();
  return config.oauthApp;
}

export function setOAuthAppConfig(appConfig: OAuthAppConfig): void {
  const config = loadConfig();
  config.oauthApp = appConfig;
  saveConfig(config);
}

export function clearOAuthAppConfig(): void {
  const config = loadConfig();
  delete config.oauthApp;
  saveConfig(config);
}
