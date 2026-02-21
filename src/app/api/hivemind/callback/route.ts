import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { createHivemindUser } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import {
  exchangeCodeForTokens,
  calculateExpirationDate,
  validateState,
} from '@/lib/twitter/oauth2';

export async function GET(request: NextRequest) {
  try {
    console.log('======== HIVEMIND CALLBACK START ========');
    console.log('Time:', new Date().toISOString());

    const searchParams = request.nextUrl.searchParams;

    // Check which OAuth version is being used
    const oauthVersion = request.cookies.get('hivemind_oauth_version')?.value || '1.0a';

    console.log(`OAuth ${oauthVersion} flow`);

    // OAuth 2.0 flow
    if (oauthVersion === '2.0') {
      return handleOAuth2Callback(request, searchParams);
    }

    // OAuth 1.0a flow (legacy)
    return handleOAuth1Callback(request, searchParams);
  } catch (error: any) {
    console.error('=== HIVEMIND OAUTH CALLBACK ERROR ===');
    console.error('Error:', error);

    const response = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/hivemind?error=${encodeURIComponent(error.message || 'callback_error')}`
    );
    clearOAuthCookies(response);

    return response;
  }
}

/**
 * Handle OAuth 2.0 callback flow
 */
async function handleOAuth2Callback(request: NextRequest, searchParams: URLSearchParams) {
  // Get OAuth 2.0 parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('OAuth 2.0 parameters:', {
    hasCode: !!code,
    hasState: !!state,
    error: error || 'none',
  });

  // Check for OAuth errors
  if (error) {
    console.error('OAuth 2.0 error from Twitter:', error, errorDescription);
    throw new Error(errorDescription || error);
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('Missing OAuth 2.0 parameters');
    throw new Error('Missing OAuth 2.0 code or state parameter');
  }

  // Get stored state and code verifier from cookies
  const storedState = request.cookies.get('hivemind_oauth2_state')?.value;
  const codeVerifier = request.cookies.get('hivemind_oauth2_code_verifier')?.value;
  const userId = request.cookies.get('hivemind_user_id')?.value;
  const twitterAppId = request.cookies.get('hivemind_twitter_app_id')?.value;

  if (!storedState || !codeVerifier) {
    console.error('Missing stored OAuth 2.0 state or code verifier');
    throw new Error('Invalid OAuth 2.0 session - missing state or code verifier');
  }

  // Validate state parameter (CSRF protection)
  if (!validateState(storedState, state)) {
    console.error('State parameter mismatch');
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  console.log('State validated successfully');

  // Get TwitterApp credentials
  if (!twitterAppId) {
    console.error('No TwitterApp ID in cookie');
    throw new Error('Missing TwitterApp ID');
  }

  const twitterApp = await getTwitterAppById(twitterAppId);
  if (!twitterApp) {
    console.error('TwitterApp not found:', twitterAppId);
    throw new Error('TwitterApp not found');
  }

  const clientId = twitterApp.clientId;
  const clientSecret = twitterApp.clientSecret;
  const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/hivemind/callback`;

  if (!clientId || !clientSecret) {
    console.error('TwitterApp missing OAuth 2.0 credentials');
    throw new Error('TwitterApp not configured for OAuth 2.0');
  }

  console.log('Using OAuth 2.0 credentials from TwitterApp:', twitterApp.name);

  // Exchange authorization code for tokens
  console.log('Exchanging authorization code for tokens...');
  const tokenData = await exchangeCodeForTokens({
    code,
    clientId,
    clientSecret,
    redirectUri,
    codeVerifier,
  });

  console.log('Tokens obtained:', {
    hasAccessToken: !!tokenData.accessToken,
    hasRefreshToken: !!tokenData.refreshToken,
    expiresIn: tokenData.expiresIn,
    scope: tokenData.scope,
  });

  // Calculate expiration date
  const expiresAt = calculateExpirationDate(tokenData.expiresIn);

  // Get user info using OAuth 2.0 access token
  console.log('Getting Hivemind user info with OAuth 2.0...');
  const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url', {
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
    },
  });

  if (!userResponse.ok) {
    const errorText = await userResponse.text();
    console.error('Failed to get user info:', errorText);
    throw new Error('Failed to get user info from Twitter API');
  }

  const userData = await userResponse.json();
  const user = userData.data;

  if (!user) {
    console.error('No user data in response');
    throw new Error('Failed to get user data from Twitter');
  }

  console.log('Hivemind user connected:', {
    id: user.id,
    username: user.username,
    name: user.name,
  });

  // Save user to database with OAuth 2.0 tokens (no webhook registration for Hivemind)
  console.log('Saving Hivemind user to database with OAuth 2.0 tokens...');
  await createHivemindUser({
    userId: user.id,
    username: user.username,
    displayName: user.name || user.username,
    profileImageUrl: user.profile_image_url,
    // Keep OAuth 1.0a fields empty for now (required by schema)
    accessToken: '',
    accessTokenSecret: '',
    // OAuth 2.0 fields
    oauth2AccessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresAt,
    scope: tokenData.scope,
  });

  console.log('Hivemind user saved to database with OAuth 2.0 credentials');
  console.log('   Username:', user.username);
  console.log('   Expires at:', expiresAt.toISOString());
  console.log('   No webhooks registered for Hivemind users');

  // Clear cookies and redirect
  const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?success=true`);
  clearOAuthCookies(response);

  return response;
}

/**
 * Handle OAuth 1.0a callback flow (legacy)
 */
async function handleOAuth1Callback(request: NextRequest, searchParams: URLSearchParams) {
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  console.log('OAuth 1.0a parameters:', {
    hasToken: !!oauthToken,
    hasVerifier: !!oauthVerifier,
  });

  if (!oauthToken || !oauthVerifier) {
    console.error('Missing OAuth 1.0a parameters');
    throw new Error('Missing OAuth 1.0a parameters');
  }

  // Get stored data from cookies
  const oauthTokenSecret = request.cookies.get('hivemind_oauth_token_secret')?.value;
  const userId = request.cookies.get('hivemind_user_id')?.value;
  const twitterAppId = request.cookies.get('hivemind_twitter_app_id')?.value;

  if (!oauthTokenSecret || !userId) {
    console.error('Missing stored OAuth 1.0a data');
    throw new Error('Invalid OAuth 1.0a session');
  }

  // Get credentials from TwitterApp
  if (!twitterAppId) {
    console.error('No Twitter app ID in session');
    throw new Error('Missing TwitterApp ID');
  }

  const twitterApp = await getTwitterAppById(twitterAppId);
  if (!twitterApp) {
    console.error('Twitter app not found:', twitterAppId);
    throw new Error('TwitterApp not found');
  }

  const consumerKey = twitterApp.consumerKey;
  const consumerSecret = twitterApp.consumerSecret;

  console.log('Using OAuth 1.0a credentials from TwitterApp:', twitterApp.name);

  // Initialize Twitter client with temporary credentials
  const client = new TwitterApi({
    appKey: consumerKey,
    appSecret: consumerSecret,
    accessToken: oauthToken,
    accessSecret: oauthTokenSecret,
  });

  // Exchange temporary credentials for permanent tokens
  console.log('Exchanging temporary tokens...');
  const {
    client: loggedClient,
    accessToken,
    accessSecret,
  } = await client.login(oauthVerifier);

  // Get authenticated user info
  console.log('Getting Hivemind user info...');
  const userResponse = await loggedClient.v2.me({
    'user.fields': ['name', 'username', 'profile_image_url'],
  });

  if (!userResponse.data) {
    console.error('Failed to get user data');
    throw new Error('Failed to get user data from Twitter');
  }

  const user = userResponse.data;

  console.log('Hivemind user connected:', {
    id: user.id,
    username: user.username,
    name: user.name,
  });

  // Save user to database (no webhook registration for Hivemind)
  console.log('Saving Hivemind user to database...');
  await createHivemindUser({
    userId: user.id,
    username: user.username,
    displayName: user.name || user.username,
    profileImageUrl: user.profile_image_url,
    accessToken,
    accessTokenSecret: accessSecret,
  });

  console.log('Hivemind user saved to database');
  console.log('   Username:', user.username);
  console.log('   No webhooks registered for Hivemind users');

  // Clear cookies and redirect
  const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?success=true`);
  clearOAuthCookies(response);

  return response;
}

/**
 * Clear all OAuth-related cookies
 */
function clearOAuthCookies(response: NextResponse) {
  // OAuth 1.0a cookies
  response.cookies.delete('hivemind_oauth_token');
  response.cookies.delete('hivemind_oauth_token_secret');

  // OAuth 2.0 cookies
  response.cookies.delete('hivemind_oauth2_state');
  response.cookies.delete('hivemind_oauth2_code_verifier');
  response.cookies.delete('hivemind_oauth_version');

  // Common cookies
  response.cookies.delete('hivemind_user_id');
  response.cookies.delete('hivemind_twitter_app_id');
}