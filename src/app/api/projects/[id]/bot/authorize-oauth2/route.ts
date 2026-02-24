import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import {
  generatePKCEChallenge,
  generateState,
  buildAuthorizationUrl,
  DEFAULT_BOT_SCOPES,
} from '@/lib/twitter/oauth2';

/**
 * OAuth 2.0 Authorization Endpoint
 *
 * GET: Start OAuth 2.0 flow with PKCE for connecting a bot to a project
 *
 * OAuth 2.0 provides:
 * - Modern authentication with granular scopes
 * - Tweet posting capabilities (without media)
 * - User profile access
 * - Refresh tokens for long-lived access
 *
 * IMPORTANT: OAuth 2.0 does NOT support:
 * - Media upload (images, videos, GIFs) - use OAuth 1.0a for this
 * - Direct messages - use OAuth 1.0a for this
 * - Some legacy v1.1 API endpoints
 *
 * Scopes requested:
 * - tweet.read: Read tweets
 * - tweet.write: Post tweets (text only)
 * - users.read: Read user profile
 * - offline.access: Get refresh token for long-lived access
 *
 * This endpoint is PUBLIC - anyone with the project link can connect their bot
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // This endpoint is PUBLIC - anyone with the project link can connect a bot
    const session = await getServerSession(authOptions);
    const isAdmin = session && session.user;

    const { id: projectId } = await params;

    console.log('');
    console.log('================================================================================');
    console.log('🔐 OAuth 2.0 Authorization Request (with PKCE)');
    console.log('================================================================================');
    console.log('   Project ID:', projectId);
    console.log('   Is Admin:', isAdmin);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('❌ Project not found:', projectId);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/project/${projectId}?error=project_not_found`
      );
    }

    console.log('✅ Project found:', project.name);

    // Get credentials from the project's TwitterApp
    const twitterApp = await getTwitterAppByProjectId(projectId);

    if (!twitterApp) {
      console.error('❌ Project has no TwitterApp configured');
      return NextResponse.redirect(
        isAdmin
          ? `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=no_twitter_app`
          : `${process.env.NEXTAUTH_URL}/project/${projectId}?error=no_twitter_app`
      );
    }

    // Check if OAuth 2.0 credentials are available
    if (!twitterApp.clientId || !twitterApp.clientSecret) {
      console.error('❌ TwitterApp missing OAuth 2.0 credentials (Client ID/Secret)');
      return NextResponse.redirect(
        isAdmin
          ? `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=oauth2_not_configured`
          : `${process.env.NEXTAUTH_URL}/project/${projectId}?error=oauth2_not_configured`
      );
    }

    const twitterAppId = twitterApp.id;
    console.log('🔑 Using OAuth 2.0 from TwitterApp:', twitterApp.name);
    console.log('   Client ID exists:', !!twitterApp.clientId);
    console.log('   Client Secret exists:', !!twitterApp.clientSecret);
    console.log('');

    const clientId = twitterApp.clientId;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/bot-twitter/callback`;

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = generatePKCEChallenge();
    const state = generateState();

    console.log('🔒 PKCE Configuration:');
    console.log('   State:', state);
    console.log('   Code Challenge Method: S256');
    console.log('   Redirect URI:', redirectUri);
    console.log('');

    // Build authorization URL
    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scopes: DEFAULT_BOT_SCOPES,
    });

    console.log('✅ OAuth 2.0 authorization URL generated');
    console.log('   Scopes requested:', DEFAULT_BOT_SCOPES.join(', '));
    console.log('');

    // Store state and PKCE verifier in secure cookies
    const response = NextResponse.redirect(authUrl);

    // OAuth 2.0 specific cookies
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

    // Project and app metadata
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

    // OAuth version indicator
    response.cookies.set('oauth_version', '2.0', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // Public flow indicator
    response.cookies.set('oauth_public_flow', (!isAdmin).toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    console.log('🚀 Redirecting to Twitter OAuth 2.0 authorization...');
    console.log('================================================================================');
    console.log('');

    return response;
  } catch (error: any) {
    console.error('');
    console.error('================================================================================');
    console.error('❌ OAuth 2.0 Authorization Error');
    console.error('================================================================================');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error status:', error.status);

    // Log additional error details
    if (error.data) {
      console.error('   Twitter error data:', JSON.stringify(error.data, null, 2));
    }
    if (error.errors) {
      console.error('   Twitter errors:', JSON.stringify(error.errors, null, 2));
    }

    console.error('================================================================================');
    console.error('');

    const { id: projectId } = await params;
    const session = await getServerSession(authOptions);
    const isAdmin = session && session.user;

    return NextResponse.redirect(
      isAdmin
        ? `${process.env.NEXTAUTH_URL}/dashboard/projects/${projectId}?error=${encodeURIComponent(error.message || 'oauth2_failed')}`
        : `${process.env.NEXTAUTH_URL}/project/${projectId}?error=${encodeURIComponent(error.message || 'oauth2_failed')}`
    );
  }
}