import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomBytes, createHash } from 'crypto';
import { URL, URLSearchParams } from 'url';
import type { OAuthTokens } from './types/index.js';

// Linear OAuth configuration
const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_REVOKE_URL = 'https://api.linear.app/oauth/revoke';

const REDIRECT_URI = 'http://localhost:3847/callback';
const SCOPES = ['read', 'write', 'issues:create', 'comments:create'];

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return randomBytes(16).toString('hex');
}

export async function startOAuthFlow(config: OAuthConfig): Promise<OAuthTokens> {
  const clientId = config.clientId;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:3847`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e53935;">Authentication Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e53935;">Authentication Failed</h1>
                <p>State mismatch - possible CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e53935;">Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('No authorization code'));
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, codeVerifier, clientId, config.clientSecret);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #4caf50;">Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);

          server.close();
          resolve(tokens);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e53935;">Authentication Failed</h1>
                <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(3847, '127.0.0.1', () => {
      const authUrl = buildAuthorizationUrl(clientId, codeChallenge, state);
      console.log('\nOpening browser for authentication...');
      console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

      // Open browser
      openBrowser(authUrl);
    });

    server.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(new Error('Port 3847 is already in use. Please close any other OAuth flows and try again.'));
      } else {
        reject(err);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

function buildAuthorizationUrl(clientId: string, codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(','),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'consent'
  });

  return `${LINEAR_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret?: string
): Promise<OAuthTokens> {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: codeVerifier
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  const response = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token exchange failed: ${errorData}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type,
    scope: data.scope
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string
): Promise<OAuthTokens> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  const response = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token refresh failed: ${errorData}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type,
    scope: data.scope
  };
}

export async function revokeToken(accessToken: string): Promise<void> {
  const response = await fetch(LINEAR_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    // Revoke failures are not critical - token may already be expired
    console.warn('Warning: Token revocation may have failed');
  }
}

function openBrowser(url: string): void {
  const { exec } = require('child_process');
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux and others
    command = `xdg-open "${url}"`;
  }

  exec(command, (err: Error | null) => {
    if (err) {
      console.error('Could not open browser automatically.');
    }
  });
}

export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  // Consider token expired 5 minutes before actual expiry
  return Date.now() > expiresAt - 5 * 60 * 1000;
}
