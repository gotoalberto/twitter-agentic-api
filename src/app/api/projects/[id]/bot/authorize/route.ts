import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { TwitterApi } from 'twitter-api-v2';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';

/**
 * GET: Start OAuth 1.0a flow for connecting a bot to a specific project
 *
 * Credentials are loaded from the project's associated TwitterApp (stored in DB).
 * Falls back to env vars if no TwitterApp is configured (backward compat).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=project_not_found`
      );
    }

    // Get credentials from the project's TwitterApp (DB) or fall back to env vars
    let apiKey: string | undefined;
    let apiSecret: string | undefined;
    let twitterAppId: string | undefined;

    const twitterApp = await getTwitterAppByProjectId(projectId);

    if (twitterApp) {
      apiKey = twitterApp.consumerKey;
      apiSecret = twitterApp.consumerSecret;
      twitterAppId = twitterApp.id;
      console.log('🔐 Using credentials from TwitterApp DB:', twitterApp.name);
    } else {
      // Fallback to env vars for projects without an associated app
      apiKey = process.env.TWITTER_OAUTH_API_KEY;
      apiSecret = process.env.TWITTER_OAUTH_API_SECRET;
      console.log('🔐 Using credentials from env vars (no TwitterApp configured)');
    }

    if (!apiKey || !apiSecret) {
      console.error('Twitter OAuth 1.0a credentials not configured');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=twitter_not_configured`
      );
    }

    console.log('🔐 Initializing Twitter OAuth 1.0a flow for project:', project.name);

    // Build callback URL
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/bot-twitter/callback`;
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

    console.log('✅ OAuth auth link generated');

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

    return response;
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
