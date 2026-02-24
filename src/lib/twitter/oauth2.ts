/**
 * OAuth 2.0 utilities for Twitter/X API v2
 *
 * Implements Authorization Code flow with PKCE for user authentication
 * and Application-Only (Bearer Token) flow for read-only operations
 *
 * Documentation:
 * - https://docs.x.com/fundamentals/authentication/oauth-2-0/overview
 * - https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
 * - https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only
 */

import crypto from 'crypto';

/**
 * OAuth 2.0 scopes for Twitter/X API
 * https://docs.x.com/fundamentals/authentication/oauth-2-0/scopes
 */
export const OAUTH2_SCOPES = {
  // Tweet scopes
  TWEET_READ: 'tweet.read',
  TWEET_WRITE: 'tweet.write',
  TWEET_MODERATE_WRITE: 'tweet.moderate.write',

  // User scopes
  USERS_READ: 'users.read',
  FOLLOWS_READ: 'follows.read',
  FOLLOWS_WRITE: 'follows.write',

  // Direct Message scopes
  DM_READ: 'dm.read',
  DM_WRITE: 'dm.write',

  // Other scopes
  SPACE_READ: 'space.read',
  MUTE_READ: 'mute.read',
  MUTE_WRITE: 'mute.write',
  LIKE_READ: 'like.read',
  LIKE_WRITE: 'like.write',
  LIST_READ: 'list.read',
  LIST_WRITE: 'list.write',
  BLOCK_READ: 'block.read',
  BLOCK_WRITE: 'block.write',
  BOOKMARK_READ: 'bookmark.read',
  BOOKMARK_WRITE: 'bookmark.write',

  // Offline access for refresh tokens
  OFFLINE_ACCESS: 'offline.access',
} as const;

/**
 * Default scopes needed for bot operations
 */
export const DEFAULT_BOT_SCOPES = [
  OAUTH2_SCOPES.TWEET_READ,
  OAUTH2_SCOPES.TWEET_WRITE,
  OAUTH2_SCOPES.USERS_READ,
  OAUTH2_SCOPES.DM_READ,
  OAUTH2_SCOPES.DM_WRITE,
  OAUTH2_SCOPES.OFFLINE_ACCESS, // Required for refresh tokens
];

/**
 * Default scopes for Hivemind users
 */
export const DEFAULT_HIVEMIND_SCOPES = [
  OAUTH2_SCOPES.TWEET_READ,
  OAUTH2_SCOPES.TWEET_WRITE,
  OAUTH2_SCOPES.USERS_READ,
  OAUTH2_SCOPES.LIKE_READ,
  OAUTH2_SCOPES.LIKE_WRITE,
  OAUTH2_SCOPES.OFFLINE_ACCESS, // Required for refresh tokens
];

/**
 * Twitter OAuth 2.0 endpoints
 */
export const OAUTH2_ENDPOINTS = {
  AUTHORIZE: 'https://twitter.com/i/oauth2/authorize',
  TOKEN: 'https://api.twitter.com/2/oauth2/token',
  REVOKE: 'https://api.twitter.com/2/oauth2/revoke',
} as const;

/**
 * Generate PKCE code verifier and challenge
 * https://www.rfc-editor.org/rfc/rfc7636
 */
export function generatePKCEChallenge(): { codeVerifier: string; codeChallenge: string } {
  // Generate a random 43-128 character code verifier
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  // Generate code challenge by hashing the verifier
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter for OAuth 2.0
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Build OAuth 2.0 authorization URL with PKCE
 */
export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: string[];
}): string {
  const url = new URL(OAUTH2_ENDPOINTS.AUTHORIZE);

  const searchParams = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(' '),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256', // SHA-256 hashing
  });

  url.search = searchParams.toString();
  return url.toString();
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}> {
  console.log('📤 Exchanging code for tokens...');
  console.log('   Client ID:', params.clientId);
  console.log('   Redirect URI:', params.redirectUri);
  console.log('   Code length:', params.code.length);
  console.log('   Code verifier length:', params.codeVerifier.length);

  const response = await fetch(OAUTH2_ENDPOINTS.TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Token exchange failed:');
    console.error('   Status:', response.status);
    console.error('   Status text:', response.statusText);
    console.error('   Response body:', error);
    throw new Error(`Failed to exchange code for tokens: ${response.status} ${error}`);
  }

  const data = await response.json();

  console.log('✅ Token exchange successful');
  console.log('   Has access token:', !!data.access_token);
  console.log('   Has refresh token:', !!data.refresh_token);
  console.log('   Expires in:', data.expires_in);
  console.log('   Scope:', data.scope);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Only present if offline.access scope was requested
    expiresIn: data.expires_in || 7200, // Default 2 hours
    scope: data.scope,
  };
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}> {
  const response = await fetch(OAUTH2_ENDPOINTS.TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh failed:', error);
    throw new Error(`Failed to refresh token: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // New refresh token (if issued)
    expiresIn: data.expires_in || 7200, // Default 2 hours
    scope: data.scope,
  };
}

/**
 * Generate Bearer Token for Application-Only authentication
 * This is for read-only operations without user context
 * https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only
 */
export async function generateBearerToken(params: {
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const response = await fetch(OAUTH2_ENDPOINTS.TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Bearer token generation failed:', error);
    throw new Error(`Failed to generate bearer token: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Revoke an access or refresh token
 */
export async function revokeToken(params: {
  token: string;
  tokenType: 'access_token' | 'refresh_token';
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const response = await fetch(OAUTH2_ENDPOINTS.REVOKE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      token: params.token,
      token_type_hint: params.tokenType,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token revocation failed:', error);
    throw new Error(`Failed to revoke token: ${response.status} ${error}`);
  }
}

/**
 * Check if a token is expired based on the expiration time
 */
export function isTokenExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false; // If no expiration, assume not expired

  const expiration = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();

  // Add 5 minute buffer to refresh before actual expiration
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiration.getTime() - bufferMs;
}

/**
 * Calculate token expiration date from expires_in seconds
 */
export function calculateExpirationDate(expiresIn: number): Date {
  const now = new Date();
  return new Date(now.getTime() + expiresIn * 1000);
}

/**
 * Validate OAuth 2.0 state parameter
 */
export function validateState(storedState: string, receivedState: string): boolean {
  return storedState === receivedState;
}

/**
 * Parse OAuth 2.0 scopes from string
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString.split(' ').filter(Boolean);
}

/**
 * Format scopes array to string
 */
export function formatScopes(scopes: string[]): string {
  return scopes.join(' ');
}