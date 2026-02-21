import { NextRequest, NextResponse } from 'next/server';
import { createHivemindUser } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import {
  exchangeCodeForTokens,
  calculateExpirationDate,
  validateState,
} from '@/lib/twitter/oauth2';

/**
 * GET: Handle OAuth 2.0 callback for Hivemind users
 *
 * Hivemind ONLY uses OAuth 2.0 because:
 * - No webhooks needed (users manually publish content)
 * - Better security with PKCE
 * - Better UX with modern OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    console.log('======== HIVEMIND OAUTH 2.0 CALLBACK START ========');
    console.log('Time:', new Date().toISOString());

    const searchParams = request.nextUrl.searchParams;

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
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=${encodeURIComponent(errorDescription || error)}`
      );
      clearOAuthCookies(response);
      return response;
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing OAuth 2.0 parameters');
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=missing_oauth_params`
      );
      clearOAuthCookies(response);
      return response;
    }

    // Get stored state and code verifier from cookies
    const storedState = request.cookies.get('hivemind_oauth2_state')?.value;
    const codeVerifier = request.cookies.get('hivemind_oauth2_code_verifier')?.value;
    const userId = request.cookies.get('hivemind_user_id')?.value;
    const twitterAppId = request.cookies.get('hivemind_twitter_app_id')?.value;

    if (!storedState || !codeVerifier) {
      console.error('Missing stored OAuth 2.0 state or code verifier');
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=invalid_session`
      );
      clearOAuthCookies(response);
      return response;
    }

    // Validate state parameter (CSRF protection)
    if (!validateState(storedState, state)) {
      console.error('State parameter mismatch');
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=invalid_state`
      );
      clearOAuthCookies(response);
      return response;
    }

    console.log('State validated successfully');

    // Get TwitterApp credentials
    if (!twitterAppId) {
      console.error('No TwitterApp ID in cookie');
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=missing_app_id`
      );
      clearOAuthCookies(response);
      return response;
    }

    const twitterApp = await getTwitterAppById(twitterAppId);
    if (!twitterApp) {
      console.error('TwitterApp not found:', twitterAppId);
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=app_not_found`
      );
      clearOAuthCookies(response);
      return response;
    }

    if (!twitterApp.clientId || !twitterApp.clientSecret) {
      console.error('TwitterApp missing OAuth 2.0 credentials');
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=oauth2_not_configured`
      );
      clearOAuthCookies(response);
      return response;
    }

    console.log('Using OAuth 2.0 credentials from TwitterApp:', twitterApp.name);

    // Exchange authorization code for tokens
    const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/hivemind/callback`;

    console.log('Exchanging code for tokens...');
    const tokenData = await exchangeCodeForTokens({
      code,
      clientId: twitterApp.clientId,
      clientSecret: twitterApp.clientSecret,
      redirectUri,
      codeVerifier,
    });

    console.log('Token exchange successful');
    console.log('   Access token received');
    console.log('   Refresh token:', tokenData.refresh_token ? 'received' : 'not received');
    console.log('   Scope:', tokenData.scope);

    // Get user info using the access token
    console.log('Fetching user information...');
    const userInfoResponse = await fetch('https://api.x.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', userInfoResponse.statusText);
      const response = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/hivemind?error=user_info_failed`
      );
      clearOAuthCookies(response);
      return response;
    }

    const userInfo = await userInfoResponse.json();
    const twitterUser = userInfo.data;

    console.log('User info retrieved:');
    console.log('   Username:', twitterUser.username);
    console.log('   User ID:', twitterUser.id);
    console.log('   Name:', twitterUser.name);

    // Calculate token expiration
    const expiresAt = calculateExpirationDate(tokenData.expires_in);

    // Save Hivemind user to database
    console.log('Saving Hivemind user to database...');
    await createHivemindUser({
      userId: twitterUser.id,
      username: twitterUser.username,
      displayName: twitterUser.name || twitterUser.username,
      profileImageUrl: twitterUser.profile_image_url,
      // OAuth 1.0a fields (required by schema but empty for OAuth 2.0)
      accessToken: '',  // Empty for OAuth 2.0
      accessTokenSecret: '',  // Empty for OAuth 2.0
      // OAuth 2.0 fields
      oauth2AccessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt,
      scope: tokenData.scope,
    });

    console.log('✅ Hivemind user saved successfully');
    console.log('   Username:', twitterUser.username);
    console.log('   OAuth version: 2.0');
    console.log('   Scopes:', tokenData.scope);
    console.log('   Expires at:', expiresAt.toISOString());
    console.log('   No webhooks registered (Hivemind users don\'t need webhooks)');

    // Clear cookies and redirect with success
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?success=true`);
    clearOAuthCookies(response);

    console.log('======== HIVEMIND OAUTH 2.0 CALLBACK SUCCESS ========');
    return response;

  } catch (error: any) {
    console.error('======== HIVEMIND OAUTH 2.0 CALLBACK ERROR ========');
    console.error('Error:', error);
    console.error('Stack:', error.stack);

    const response = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/hivemind?error=${encodeURIComponent(error.message || 'callback_error')}`
    );
    clearOAuthCookies(response);

    return response;
  }
}

/**
 * Clear all OAuth-related cookies
 */
function clearOAuthCookies(response: NextResponse) {
  // OAuth 2.0 cookies
  response.cookies.delete('hivemind_oauth2_state');
  response.cookies.delete('hivemind_oauth2_code_verifier');

  // Shared cookies
  response.cookies.delete('hivemind_user_id');
  response.cookies.delete('hivemind_twitter_app_id');
  response.cookies.delete('hivemind_oauth_version');

  // Legacy OAuth 1.0a cookies (cleanup if they exist)
  response.cookies.delete('hivemind_oauth_token');
  response.cookies.delete('hivemind_oauth_token_secret');
}