import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { TwitterApi } from 'twitter-api-v2';
import { getHivemindConfig } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import {
  generatePKCEChallenge,
  generateState,
  buildAuthorizationUrl,
  DEFAULT_HIVEMIND_SCOPES,
} from '@/lib/twitter/oauth2';

/**
 * GET: Start OAuth flow for Hivemind user connection
 *
 * This endpoint supports both OAuth 1.0a (legacy) and OAuth 2.0 (new).
 * It will use OAuth 2.0 if the TwitterApp has clientId/clientSecret configured,
 * otherwise falls back to OAuth 1.0a for backward compatibility.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('======== HIVEMIND AUTHORIZATION START ========');
    console.log('Time:', new Date().toISOString());

    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.log('No session found - user not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', session.user.username || session.user.name);

    // Get Hivemind configuration to determine which TwitterApp to use
    const hivemindConfig = await getHivemindConfig();
    console.log('Hivemind config loaded:', {
      enabled: hivemindConfig?.enabled,
      hasTwitterAppId: !!hivemindConfig?.twitterAppId,
      hasApiKey: !!hivemindConfig?.apiKey
    });

    if (!hivemindConfig || !hivemindConfig.enabled) {
      return NextResponse.json(
        { error: 'Hivemind is not enabled. Please contact an administrator.' },
        { status: 400 }
      );
    }

    // Get credentials from TwitterApp
    if (!hivemindConfig.twitterAppId) {
      return NextResponse.json(
        { error: 'Hivemind has no TwitterApp configured. Please assign a Twitter App to Hivemind.' },
        { status: 500 }
      );
    }

    const twitterApp = await getTwitterAppById(hivemindConfig.twitterAppId);
    if (!twitterApp) {
      return NextResponse.json(
        { error: 'Configured Twitter app not found' },
        { status: 500 }
      );
    }

    const twitterAppId = twitterApp.id;
    console.log('Using credentials from TwitterApp:', twitterApp.name);

    // Check if OAuth 2.0 credentials are available
    const useOAuth2 = twitterApp.clientId && twitterApp.clientSecret;

    if (useOAuth2) {
      // ====================================
      // OAuth 2.0 Authorization Code with PKCE
      // ====================================
      console.log('Initializing Twitter OAuth 2.0 flow with PKCE for Hivemind user');

      const clientId = twitterApp.clientId!;
      const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/hivemind/callback`;

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = generatePKCEChallenge();
      const state = generateState();

      // Build authorization URL
      const authUrl = buildAuthorizationUrl({
        clientId,
        redirectUri,
        state,
        codeChallenge,
        scopes: DEFAULT_HIVEMIND_SCOPES,
      });

      console.log('OAuth 2.0 authorization URL generated');
      console.log('   Scopes:', DEFAULT_HIVEMIND_SCOPES.join(', '));

      // Store state and PKCE verifier in secure cookies
      const response = NextResponse.redirect(authUrl);

      response.cookies.set('hivemind_oauth2_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });

      response.cookies.set('hivemind_oauth2_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store user ID and twitterAppId to use in callback
      response.cookies.set('hivemind_user_id', session.user.id || '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      response.cookies.set('hivemind_twitter_app_id', twitterAppId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Set flag to indicate OAuth 2.0 flow
      response.cookies.set('hivemind_oauth_version', '2.0', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      return response;
    } else {
      // ====================================
      // OAuth 1.0a (Legacy fallback)
      // ====================================
      console.log('OAuth 2.0 credentials not found, falling back to OAuth 1.0a');
      console.log('Initializing Twitter OAuth 1.0a flow for Hivemind user');

      const apiKey = twitterApp.consumerKey;
      const apiSecret = twitterApp.consumerSecret;

      // Build callback URL
      const callbackUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/hivemind/callback`;
      console.log('   Callback URL:', callbackUrl);

      // Initialize Twitter client
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
      });

      // Generate auth link
      const authLink = await client.generateAuthLink(callbackUrl, {
        linkMode: 'authorize',
      });

      console.log('OAuth 1.0a auth link generated');

      // Store oauth_token_secret, oauth_token, user ID and twitterAppId in secure cookies
      const response = NextResponse.redirect(authLink.url);

      response.cookies.set('hivemind_oauth_token_secret', authLink.oauth_token_secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });

      response.cookies.set('hivemind_oauth_token', authLink.oauth_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store user ID
      response.cookies.set('hivemind_user_id', session.user.id || '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store twitterAppId so the callback knows which app to use
      response.cookies.set('hivemind_twitter_app_id', twitterAppId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Set flag to indicate OAuth 1.0a flow
      response.cookies.set('hivemind_oauth_version', '1.0a', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      return response;
    }
  } catch (error: any) {
    console.error('Error in Hivemind authorize:', error);

    // Provide clearer error messages based on the error type
    let userMessage = error.message || 'oauth_failed';

    if (error.message?.includes('403') || error.code === 403 || error.status === 403) {
      userMessage =
        'Twitter OAuth 1.0a credentials are invalid (403). ' +
        'Check that: 1) The Consumer Key/Secret in the Twitter App are correct OAuth 1.0a credentials, ' +
        '2) The Twitter App has OAuth 1.0a enabled in the Developer Portal, ' +
        '3) The app has Read and Write permissions.';
      console.error('403 hint: OAuth 1.0a may not be enabled in the Twitter Developer Portal, or Consumer Key/Secret are wrong');
    }

    // Log additional error details if available
    if (error.data) {
      console.error('   Twitter error data:', JSON.stringify(error.data));
    }
    if (error.errors) {
      console.error('   Twitter errors:', JSON.stringify(error.errors));
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}