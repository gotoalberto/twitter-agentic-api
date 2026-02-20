import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { getHivemindConfig } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';

export async function GET(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Hivemind configuration to determine which TwitterApp to use
    const hivemindConfig = await getHivemindConfig();

    if (!hivemindConfig || !hivemindConfig.enabled) {
      return NextResponse.json(
        { error: 'Hivemind is not enabled. Please contact an administrator.' },
        { status: 400 }
      );
    }

    // Determine which credentials to use
    let consumerKey: string;
    let consumerSecret: string;

    if (hivemindConfig.twitterAppId) {
      // Use the configured TwitterApp
      const twitterApp = await getTwitterAppById(hivemindConfig.twitterAppId);
      if (!twitterApp) {
        return NextResponse.json(
          { error: 'Configured Twitter app not found' },
          { status: 500 }
        );
      }
      consumerKey = twitterApp.consumerKey;
      consumerSecret = twitterApp.consumerSecret;
    } else {
      // Fallback to environment variables
      consumerKey = process.env.TWITTER_OAUTH_API_KEY!;
      consumerSecret = process.env.TWITTER_OAUTH_API_SECRET!;

      if (!consumerKey || !consumerSecret) {
        return NextResponse.json(
          { error: 'OAuth credentials not configured' },
          { status: 500 }
        );
      }
    }

    // Initialize OAuth 1.0a
    const oauth = new OAuth({
      consumer: {
        key: consumerKey,
        secret: consumerSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      }
    });

    // Step 1: Get request token
    const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    const callbackUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/hivemind/callback`;

    const requestData = {
      url: requestTokenUrl,
      method: 'POST',
      data: {
        oauth_callback: callbackUrl
      }
    };

    const headers = oauth.toHeader(oauth.authorize(requestData));

    const tokenResponse = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `oauth_callback=${encodeURIComponent(callbackUrl)}`
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get request token:', await tokenResponse.text());
      return NextResponse.json(
        { error: 'Failed to get request token from Twitter' },
        { status: 500 }
      );
    }

    const tokenText = await tokenResponse.text();
    const params = new URLSearchParams(tokenText);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      return NextResponse.json(
        { error: 'Invalid response from Twitter' },
        { status: 500 }
      );
    }

    // Create response with redirect to Twitter authorization
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;
    const response = NextResponse.redirect(authUrl);

    // Store token secret and user ID in cookies for callback
    response.cookies.set('hivemind_oauth_token_secret', oauthTokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    response.cookies.set('hivemind_user_id', session.user.id || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    // Store which app was used (for callback to use same credentials)
    if (hivemindConfig.twitterAppId) {
      response.cookies.set('hivemind_twitter_app_id', hivemindConfig.twitterAppId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10 // 10 minutes
      });
    }

    return response;

  } catch (error) {
    console.error('Error in Hivemind authorize:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}