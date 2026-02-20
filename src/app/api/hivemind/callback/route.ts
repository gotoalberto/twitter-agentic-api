import { NextRequest, NextResponse } from 'next/server';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { createHivemindUser } from '@/lib/db/hivemind';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import { TwitterApi } from 'twitter-api-v2';

export async function GET(request: NextRequest) {
  try {
    console.log('======== HIVEMIND CALLBACK START ========');
    console.log('Time:', new Date().toISOString());

    const searchParams = request.nextUrl.searchParams;
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');

    console.log('OAuth Token received:', !!oauthToken);
    console.log('OAuth Verifier received:', !!oauthVerifier);

    if (!oauthToken || !oauthVerifier) {
      console.error('Missing OAuth parameters');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=missing_params`);
    }

    // Get stored data from cookies
    const oauthTokenSecret = request.cookies.get('hivemind_oauth_token_secret')?.value;
    const userId = request.cookies.get('hivemind_user_id')?.value;
    const twitterAppId = request.cookies.get('hivemind_twitter_app_id')?.value;

    if (!oauthTokenSecret || !userId) {
      console.error('Missing stored OAuth data');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=missing_session`);
    }

    // Determine which credentials to use
    let consumerKey: string;
    let consumerSecret: string;

    if (twitterAppId) {
      // Use the configured TwitterApp
      const twitterApp = await getTwitterAppById(twitterAppId);
      if (!twitterApp) {
        console.error('Twitter app not found:', twitterAppId);
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=app_not_found`);
      }
      consumerKey = twitterApp.consumerKey;
      consumerSecret = twitterApp.consumerSecret;
    } else {
      // Fallback to environment variables
      consumerKey = process.env.TWITTER_OAUTH_API_KEY!;
      consumerSecret = process.env.TWITTER_OAUTH_API_SECRET!;

      if (!consumerKey || !consumerSecret) {
        console.error('OAuth credentials not configured');
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=config_error`);
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

    // Step 2: Exchange for access token
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';

    const accessData = {
      url: accessTokenUrl,
      method: 'POST',
      data: {
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier
      }
    };

    const token = {
      key: oauthToken,
      secret: oauthTokenSecret
    };

    const headers = oauth.toHeader(oauth.authorize(accessData, token));

    const accessResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `oauth_verifier=${encodeURIComponent(oauthVerifier)}`
    });

    if (!accessResponse.ok) {
      console.error('Failed to get access token:', await accessResponse.text());
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=access_token_failed`);
    }

    const accessText = await accessResponse.text();
    const accessParams = new URLSearchParams(accessText);
    const accessToken = accessParams.get('oauth_token');
    const accessTokenSecret = accessParams.get('oauth_token_secret');
    const twitterUserId = accessParams.get('user_id');
    const screenName = accessParams.get('screen_name');

    if (!accessToken || !accessTokenSecret || !twitterUserId || !screenName) {
      console.error('Invalid access token response');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=invalid_response`);
    }

    console.log('✅ Hivemind user authenticated:', screenName);
    console.log('   Twitter User ID:', twitterUserId);

    // Get user details using Twitter API v2
    const twitterClient = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    });

    // Get user profile information
    const userResponse = await twitterClient.v2.me({
      'user.fields': ['name', 'username', 'profile_image_url']
    });

    const twitterUser = userResponse.data;
    console.log('Twitter user data:', {
      id: twitterUser.id,
      username: twitterUser.username,
      name: twitterUser.name,
      hasProfileImage: !!twitterUser.profile_image_url
    });

    // Save user to database (no webhook registration for Hivemind)
    await createHivemindUser({
      userId: twitterUserId,
      username: screenName,
      displayName: twitterUser.name || screenName,
      profileImageUrl: twitterUser.profile_image_url,
      accessToken,
      accessTokenSecret
    });

    console.log('✅ Hivemind user connected successfully:', screenName);
    console.log('📌 No webhooks registered for Hivemind users');
    console.log('🔄 Redirecting to /hivemind?success=true');

    // Clear cookies
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?success=true`);
    response.cookies.delete('hivemind_oauth_token_secret');
    response.cookies.delete('hivemind_user_id');
    response.cookies.delete('hivemind_twitter_app_id');

    return response;

  } catch (error) {
    console.error('Error in Hivemind OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/hivemind?error=callback_error`);
  }
}