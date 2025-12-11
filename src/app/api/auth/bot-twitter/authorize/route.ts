import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { TwitterApi } from 'twitter-api-v2';

export async function GET() {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get OAuth 1.0a credentials
    const apiKey = process.env.TWITTER_OAUTH_API_KEY;
    const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Twitter OAuth 1.0a credentials not configured');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=twitter_not_configured`
      );
    }

    console.log('🔐 Initializing Twitter OAuth 1.0a flow...');

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

    // Store oauth_token_secret in secure cookie
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

    return response;
  } catch (error: any) {
    console.error('❌ OAuth authorization error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=${encodeURIComponent(error.message || 'oauth_failed')}`
    );
  }
}
