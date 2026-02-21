import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getHivemindConfig } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import {
  generatePKCEChallenge,
  generateState,
  buildAuthorizationUrl,
  DEFAULT_HIVEMIND_SCOPES,
} from '@/lib/twitter/oauth2';

/**
 * GET: Start OAuth 2.0 flow for Hivemind user connection
 *
 * Hivemind ONLY uses OAuth 2.0 because:
 * - Hivemind users don't need webhooks (no real-time events)
 * - OAuth 2.0 provides better UX with PKCE
 * - No need for OAuth 1.0a complexity
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

    // ====================================
    // OAuth 2.0 ONLY (No OAuth 1.0a fallback)
    // ====================================

    // Hivemind requires OAuth 2.0 credentials
    if (!twitterApp.clientId || !twitterApp.clientSecret) {
      console.error('❌ Hivemind requires OAuth 2.0 credentials (Client ID/Secret)');
      console.error('   The selected Twitter App does not have OAuth 2.0 configured');
      return NextResponse.redirect('/hivemind?error=oauth2_required');
    }

    console.log('Initializing Twitter OAuth 2.0 flow with PKCE for Hivemind user');

    const clientId = twitterApp.clientId;
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
    console.log('   Client ID:', clientId.substring(0, 10) + '...');
    console.log('   Redirect URI:', redirectUri);
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

    // Set flag to indicate OAuth 2.0 flow (always 2.0 for Hivemind)
    response.cookies.set('hivemind_oauth_version', '2.0', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    console.log('======== HIVEMIND AUTHORIZATION REDIRECT ========');
    return response;

  } catch (error: any) {
    console.error('Error in Hivemind authorize:', error);

    // Provide clearer error messages
    let userMessage = error.message || 'oauth_failed';

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