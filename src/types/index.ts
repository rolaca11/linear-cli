export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthAppConfig {
  clientId: string;
  clientSecret?: string;
}

export interface Config {
  apiKey?: string;
  oauth?: OAuthTokens;
  oauthApp?: OAuthAppConfig;
  authMethod?: 'apikey' | 'oauth';
  defaultTeam?: string;
  outputFormat?: 'table' | 'json';
}

export interface GlobalOptions {
  json?: boolean;
  noColor?: boolean;
  team?: string;
}

export interface IssueListOptions extends GlobalOptions {
  state?: string;
  assignee?: string;
  project?: string;
  limit?: number;
}

export interface IssueCreateOptions extends GlobalOptions {
  title: string;
  description?: string;
  team?: string;
  state?: string;
  assignee?: string;
  project?: string;
  priority?: number;
  labels?: string[];
  estimate?: number;
}

export interface IssueUpdateOptions extends GlobalOptions {
  title?: string;
  description?: string;
  state?: string;
  assignee?: string;
  project?: string;
  priority?: number;
  labels?: string[];
  estimate?: number;
}

export interface ProjectCreateOptions extends GlobalOptions {
  name: string;
  description?: string;
  teams?: string[];
  lead?: string;
  targetDate?: string;
}

export interface ProjectUpdateOptions extends GlobalOptions {
  name?: string;
  description?: string;
  lead?: string;
  targetDate?: string;
  state?: string;
}

export interface CycleCreateOptions extends GlobalOptions {
  name?: string;
  team: string;
  startsAt: string;
  endsAt: string;
  description?: string;
}

export interface LabelCreateOptions extends GlobalOptions {
  name: string;
  team?: string;
  color?: string;
  description?: string;
}

export interface CommentCreateOptions extends GlobalOptions {
  body: string;
}
