/**
 * Utility functions for managing Twitter Bearer Tokens
 */

/**
 * Create a new bearer token using OAuth 2.0 App-Only authentication
 *
 * @param consumerKey - Twitter API Consumer Key
 * @param consumerSecret - Twitter API Consumer Secret
 * @returns Bearer token string
 */
export async function createBearerToken(
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  // Encode consumer key and secret
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

  // Request bearer token from Twitter
  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create bearer token:', error);
    throw new Error(`Failed to create bearer token: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.token_type !== 'bearer') {
    throw new Error('Invalid token type received');
  }

  return data.access_token;
}

/**
 * Revoke a bearer token (invalidate it)
 *
 * @param consumerKey - Twitter API Consumer Key
 * @param consumerSecret - Twitter API Consumer Secret
 * @param bearerToken - Bearer token to revoke
 */
export async function revokeBearerToken(
  consumerKey: string,
  consumerSecret: string,
  bearerToken: string
): Promise<void> {
  // Encode consumer key and secret
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/oauth2/invalidate_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: `access_token=${encodeURIComponent(bearerToken)}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to revoke bearer token:', error);
    throw new Error(`Failed to revoke bearer token: ${response.status} - ${error}`);
  }
}

/**
 * Verify if a bearer token is valid by making a test request
 *
 * @param bearerToken - Bearer token to verify
 * @returns true if valid, false otherwise
 */
export async function verifyBearerToken(bearerToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error verifying bearer token:', error);
    return false;
  }
}