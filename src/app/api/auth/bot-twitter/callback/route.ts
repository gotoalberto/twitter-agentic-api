import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { saveConnectedBot } from '@/lib/twitter/bot';

export async function GET(request: NextRequest) {
  try {
    console.log('=== BOT TWITTER OAUTH 1.0a CALLBACK STARTED ===');

    const searchParams = request.nextUrl.searchParams;
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');

    // Get oauth_token_secret from cookie
    const oauthTokenSecret = request.cookies.get('oauth_token_secret')?.value;

    console.log('📋 OAuth parameters:', {
      hasToken: !!oauthToken,
      hasVerifier: !!oauthVerifier,
      hasSecret: !!oauthTokenSecret,
    });

    // Validate parameters
    if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
      console.error('❌ Missing OAuth parameters');
      return NextResponse.redirect(
        new URL('/dashboard?error=oauth_params_missing', request.url)
      );
    }

    // Validate environment variables
    const apiKey = process.env.TWITTER_OAUTH_API_KEY;
    const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Twitter OAuth 1.0a credentials not configured');
      return NextResponse.redirect(
        new URL('/dashboard?error=twitter_not_configured', request.url)
      );
    }

    // Initialize Twitter client with temporary credentials
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: oauthToken,
      accessSecret: oauthTokenSecret,
    });

    // Exchange temporary credentials for permanent tokens
    console.log('🔄 Exchanging temporary tokens...');
    const {
      client: loggedClient,
      accessToken,
      accessSecret,
    } = await client.login(oauthVerifier);

    // Get authenticated user info
    console.log('👤 Getting bot user info...');
    const user = await loggedClient.v2.me({
      'user.fields': ['profile_image_url', 'description'],
    });

    if (!user.data) {
      console.error('❌ Failed to get user data');
      return NextResponse.redirect(
        new URL('/dashboard?error=twitter_user_fetch_failed', request.url)
      );
    }

    console.log('✅ Bot account connected:', {
      id: user.data.id,
      username: user.data.username,
      name: user.data.name,
    });

    // Save to Redis with encrypted tokens
    await saveConnectedBot({
      userId: user.data.id,
      username: user.data.username,
      accessToken,
      accessTokenSecret: accessSecret,
      connectedAt: new Date().toISOString(),
    });

    console.log('💾 Bot saved to Redis');

    // Clear cookies and redirect
    const response = NextResponse.redirect(
      new URL('/dashboard?success=bot_connected', request.url)
    );

    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');

    return response;
  } catch (error: any) {
    console.error('=== BOT OAUTH CALLBACK ERROR ===');
    console.error('Error:', error);

    const response = NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(error.message || 'oauth_failed')}`, request.url)
    );

    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');

    return response;
  }
}
