import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { TwitterApi } from 'twitter-api-v2';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import {
  generatePKCEChallenge,
  generateState,
  buildAuthorizationUrl,
  DEFAULT_BOT_SCOPES,
} from '@/lib/twitter/oauth2';

/**
 * GET: Start OAuth 2.0 flow with PKCE for connecting a bot to a specific project
 *
 * This endpoint supports both OAuth 1.0a (legacy) and OAuth 2.0 (new).
 * It will use OAuth 2.0 if the TwitterApp has clientId/clientSecret configured,
 * otherwise falls back to OAuth 1.0a for backward compatibility.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // This endpoint is PUBLIC - anyone with the project link can connect a bot
    // No authentication required to allow external users to connect their bots
    const session = await getServerSession(authOptions);
    const isAdmin = session && session.user;

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=project_not_found`
      );
    }

    // Get credentials from the project's TwitterApp
    const twitterApp = await getTwitterAppByProjectId(projectId);

    if (!twitterApp) {
      console.error('Project has no TwitterApp configured');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=no_twitter_app`
      );
    }

    const twitterAppId = twitterApp.id;
    console.log('🔐 Using credentials from TwitterApp:', twitterApp.name);

    // Check if OAuth 2.0 credentials are available
    const useOAuth2 = twitterApp.clientId && twitterApp.clientSecret;

    if (useOAuth2) {
      // ====================================
      // OAuth 2.0 Authorization Code with PKCE
      // ====================================
      console.log('🔐 Initializing Twitter OAuth 2.0 flow with PKCE for project:', project.name);

      const clientId = twitterApp.clientId!;
      const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/bot-twitter/callback`;

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = generatePKCEChallenge();
      const state = generateState();

      // Build authorization URL
      const authUrl = buildAuthorizationUrl({
        clientId,
        redirectUri,
        state,
        codeChallenge,
        scopes: DEFAULT_BOT_SCOPES,
      });

      console.log('✅ OAuth 2.0 authorization URL generated');
      console.log('   Scopes:', DEFAULT_BOT_SCOPES.join(', '));

      // Store state and PKCE verifier in secure cookies
      const response = NextResponse.redirect(authUrl);

      response.cookies.set('oauth2_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });

      response.cookies.set('oauth2_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store projectId and twitterAppId to use in callback
      response.cookies.set('oauth_project_id', projectId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      response.cookies.set('oauth_twitter_app_id', twitterAppId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Set flag to indicate OAuth 2.0 flow
      response.cookies.set('oauth_version', '2.0', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Set flag to indicate if this is a public flow (non-admin user)
      response.cookies.set('oauth_public_flow', (!isAdmin).toString(), {
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
      console.log('⚠️  OAuth 2.0 credentials not found, falling back to OAuth 1.0a');
      console.log('🔐 Initializing Twitter OAuth 1.0a flow for project:', project.name);

      const apiKey = twitterApp.consumerKey;
      const apiSecret = twitterApp.consumerSecret;

      // Build callback URL
      const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/bot-twitter/callback`;
      console.log('   Callback URL:', callbackUrl);

      // Initialize Twitter client (only with app credentials for OAuth flow)
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
      } as any);

      // Generate auth link
      const authLink = await client.generateAuthLink(callbackUrl, {
        linkMode: 'authorize',
      });

      console.log('✅ OAuth 1.0a auth link generated');

      // Store oauth_token_secret, oauth_token, projectId and twitterAppId in secure cookies
      const response = NextResponse.redirect(authLink.url);

      response.cookies.set('oauth_token_secret', authLink.oauth_token_secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });

      response.cookies.set('oauth_token', authLink.oauth_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store projectId to use in callback
      response.cookies.set('oauth_project_id', projectId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Store twitterAppId so the callback knows which app to use
      if (twitterAppId) {
        response.cookies.set('oauth_twitter_app_id', twitterAppId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 600,
          path: '/',
        });
      }

      // Set flag to indicate OAuth 1.0a flow
      response.cookies.set('oauth_version', '1.0a', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      // Set flag to indicate if this is a public flow (non-admin user)
      response.cookies.set('oauth_public_flow', (!isAdmin).toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });

      return response;
    }
  } catch (error: any) {
    console.error('❌ OAuth authorization error:', error);

    // Provide clearer error messages based on the error type
    let userMessage = error.message || 'oauth_failed';

    if (error.message?.includes('403') || error.code === 403 || error.status === 403) {
      userMessage =
        'Twitter OAuth 1.0a credentials are invalid (403). ' +
        'Check that: 1) The Consumer Key/Secret in the Twitter App are correct OAuth 1.0a credentials, ' +
        '2) The Twitter App has OAuth 1.0a enabled in the Developer Portal, ' +
        '3) The app has Read and Write permissions.';
      console.error('💡 403 hint: OAuth 1.0a may not be enabled in the Twitter Developer Portal, or Consumer Key/Secret are wrong');
    }

    // Log additional error details if available
    if (error.data) {
      console.error('   Twitter error data:', JSON.stringify(error.data));
    }
    if (error.errors) {
      console.error('   Twitter errors:', JSON.stringify(error.errors));
    }

    const { id: projectId } = await params;
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=${encodeURIComponent(userMessage)}`
    );
  }
}
