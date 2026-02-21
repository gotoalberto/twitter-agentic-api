import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getOrCreateDefaultProject } from '@/lib/db/projects';
import { saveBot } from '@/lib/db/bots';
import { registerWebhook, subscribeWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { saveWebhookRegistration, getWebhookRegistrationsByProjectId } from '@/lib/db/webhooks';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import {
  exchangeCodeForTokens,
  calculateExpirationDate,
  validateState,
} from '@/lib/twitter/oauth2';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Check which OAuth version is being used
    const oauthVersion = request.cookies.get('oauth_version')?.value || '1.0a';

    console.log(`=== BOT TWITTER OAUTH ${oauthVersion} CALLBACK STARTED ===`);

    // OAuth 2.0 flow
    if (oauthVersion === '2.0') {
      return handleOAuth2Callback(request, searchParams);
    }

    // OAuth 1.0a flow (legacy)
    return handleOAuth1Callback(request, searchParams);
  } catch (error: any) {
    console.error('=== BOT OAUTH CALLBACK ERROR ===');
    console.error('Error:', error);

    const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
    const errorRedirectUrl = projectIdFromCookie
      ? `/dashboard/projects/${projectIdFromCookie}?error=${encodeURIComponent(error.message || 'oauth_failed')}`
      : `/dashboard?error=${encodeURIComponent(error.message || 'oauth_failed')}`;

    const response = NextResponse.redirect(new URL(errorRedirectUrl, request.url));
    clearOAuthCookies(response);

    return response;
  }
}

/**
 * Handle OAuth 2.0 callback flow
 */
async function handleOAuth2Callback(request: NextRequest, searchParams: URLSearchParams) {
  // Get OAuth 2.0 parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('📋 OAuth 2.0 parameters:', {
    hasCode: !!code,
    hasState: !!state,
    error: error || 'none',
  });

  // Check for OAuth errors
  if (error) {
    console.error('❌ OAuth 2.0 error from Twitter:', error, errorDescription);
    throw new Error(errorDescription || error);
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('❌ Missing OAuth 2.0 parameters');
    throw new Error('Missing OAuth 2.0 code or state parameter');
  }

  // Get stored state and code verifier from cookies
  const storedState = request.cookies.get('oauth2_state')?.value;
  const codeVerifier = request.cookies.get('oauth2_code_verifier')?.value;
  const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
  const twitterAppIdFromCookie = request.cookies.get('oauth_twitter_app_id')?.value;

  if (!storedState || !codeVerifier) {
    console.error('❌ Missing stored OAuth 2.0 state or code verifier');
    throw new Error('Invalid OAuth 2.0 session - missing state or code verifier');
  }

  // Validate state parameter (CSRF protection)
  if (!validateState(storedState, state)) {
    console.error('❌ State parameter mismatch');
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  console.log('✅ State validated successfully');

  // Get TwitterApp credentials
  if (!twitterAppIdFromCookie) {
    console.error('❌ No TwitterApp ID in cookie');
    throw new Error('Missing TwitterApp ID');
  }

  const twitterApp = await getTwitterAppById(twitterAppIdFromCookie);
  if (!twitterApp) {
    console.error('❌ TwitterApp not found:', twitterAppIdFromCookie);
    throw new Error('TwitterApp not found');
  }

  const clientId = twitterApp.clientId;
  const clientSecret = twitterApp.clientSecret;
  const redirectUri = `${new URL(request.url).origin}/api/auth/bot-twitter/callback`;

  if (!clientId || !clientSecret) {
    console.error('❌ TwitterApp missing OAuth 2.0 credentials');
    throw new Error('TwitterApp not configured for OAuth 2.0');
  }

  console.log('🔑 Using OAuth 2.0 credentials from TwitterApp:', twitterApp.name);

  // Exchange authorization code for tokens
  console.log('🔄 Exchanging authorization code for tokens...');
  const tokenData = await exchangeCodeForTokens({
    code,
    clientId,
    clientSecret,
    redirectUri,
    codeVerifier,
  });

  console.log('✅ Tokens obtained:', {
    hasAccessToken: !!tokenData.accessToken,
    hasRefreshToken: !!tokenData.refreshToken,
    expiresIn: tokenData.expiresIn,
    scope: tokenData.scope,
  });

  // Calculate expiration date
  const expiresAt = calculateExpirationDate(tokenData.expiresIn);

  // Get user info using OAuth 2.0 access token
  console.log('👤 Getting bot user info with OAuth 2.0...');
  const userResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
    },
  });

  if (!userResponse.ok) {
    const errorText = await userResponse.text();
    console.error('❌ Failed to get user info:', errorText);
    throw new Error('Failed to get user info from Twitter API');
  }

  const userData = await userResponse.json();
  const user = userData.data;

  if (!user) {
    console.error('❌ No user data in response');
    throw new Error('Failed to get user data from Twitter');
  }

  console.log('✅ Bot account connected:', {
    id: user.id,
    username: user.username,
    name: user.name,
  });

  // Resolve project
  let project;
  if (projectIdFromCookie) {
    const { getProjectById } = await import('@/lib/db/projects');
    project = await getProjectById(projectIdFromCookie);
    if (!project) {
      console.error('❌ Project not found:', projectIdFromCookie);
      throw new Error('Project not found');
    }
    console.log('📦 Using project from cookie:', project.name, `(${project.id})`);
  } else {
    project = await getOrCreateDefaultProject();
    console.log('📦 Using default project:', project.name, `(${project.id})`);
  }

  // Save bot with OAuth 2.0 tokens
  console.log('💾 Saving bot to database with OAuth 2.0 tokens...');
  const savedBot = await saveBot(project.id, {
    userId: user.id,
    username: user.username,
    // Keep OAuth 1.0a fields empty for now (required by schema)
    accessToken: '',
    accessTokenSecret: '',
    // OAuth 2.0 fields
    oauth2AccessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresAt,
    scope: tokenData.scope,
  });

  console.log('✅ Bot saved to database with OAuth 2.0 credentials');
  console.log('   Bot ID:', savedBot.id);
  console.log('   Username:', savedBot.username);
  console.log('   Expires at:', expiresAt.toISOString());

  // Note: Webhook registration is handled the same way for both OAuth versions
  // The webhook subscription will use OAuth 1.0a credentials if available
  // For OAuth 2.0 only bots, webhook subscription may need to be handled differently

  // For now, skip webhook registration for OAuth 2.0 bots
  console.log('⚠️  Webhook registration skipped for OAuth 2.0 bot (not yet implemented)');

  // Clear cookies and redirect
  const redirectUrl = projectIdFromCookie
    ? `/dashboard/projects/${project.id}?success=bot_connected`
    : '/dashboard?success=bot_connected';

  console.log('✅ Redirecting to:', redirectUrl);

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  clearOAuthCookies(response);

  return response;
}

/**
 * Handle OAuth 1.0a callback flow (legacy)
 */
async function handleOAuth1Callback(request: NextRequest, searchParams: URLSearchParams) {
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  // Get oauth_token_secret from cookie
  const oauthTokenSecret = request.cookies.get('oauth_token_secret')?.value;

  console.log('📋 OAuth 1.0a parameters:', {
    hasToken: !!oauthToken,
    hasVerifier: !!oauthVerifier,
    hasSecret: !!oauthTokenSecret,
  });

  // Validate parameters
  if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
    console.error('❌ Missing OAuth 1.0a parameters');
    throw new Error('Missing OAuth 1.0a parameters');
  }

  // Get project ID and twitterAppId from cookies
  const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
  const twitterAppIdFromCookie = request.cookies.get('oauth_twitter_app_id')?.value;

  // Get credentials from TwitterApp
  if (!twitterAppIdFromCookie) {
    console.error('❌ No TwitterApp ID in cookie');
    throw new Error('Missing TwitterApp ID');
  }

  const twitterApp = await getTwitterAppById(twitterAppIdFromCookie);
  if (!twitterApp) {
    console.error('❌ TwitterApp not found:', twitterAppIdFromCookie);
    throw new Error('TwitterApp not found');
  }

  const apiKey = twitterApp.consumerKey;
  const apiSecret = twitterApp.consumerSecret;
  const bearerToken = twitterApp.bearerToken;
  const webhookEnv = twitterApp.webhookEnv;
  const resolvedTwitterAppId = twitterApp.id;
  console.log('🔑 Using credentials from TwitterApp:', twitterApp.name, '| env:', webhookEnv);

  // OAuth 1.0a flow requires consumer key/secret
  if (!apiKey || !apiSecret) {
    console.error('❌ OAuth 1.0a credentials not configured for this TwitterApp');
    return NextResponse.redirect(
      `${origin}/dashboard/projects/${projectIdFromCookie}?error=oauth1_not_configured`
    );
  }

  // Initialize Twitter client with temporary credentials
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: oauthToken,
    accessSecret: oauthTokenSecret,
  } as any);

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
    throw new Error('Failed to get user data from Twitter');
  }

  console.log('✅ Bot account connected:', {
    id: user.data.id,
    username: user.data.username,
    name: user.data.name,
  });

  // Resolve project
  let project;
  if (projectIdFromCookie) {
    const { getProjectById } = await import('@/lib/db/projects');
    project = await getProjectById(projectIdFromCookie);
    if (!project) {
      console.error('❌ Project not found:', projectIdFromCookie);
      throw new Error('Project not found');
    }
    console.log('📦 Using project from cookie:', project.name, `(${project.id})`);
  } else {
    project = await getOrCreateDefaultProject();
    console.log('📦 Using default project:', project.name, `(${project.id})`);
  }

  console.log('💾 Saving bot to database...');
  const savedBot = await saveBot(project.id, {
    userId: user.data.id,
    username: user.data.username,
    accessToken,
    accessTokenSecret: accessSecret,
  });

  console.log('✅ Bot saved to database');
  console.log('   Bot ID:', savedBot.id);
  console.log('   Username:', savedBot.username);

  // Register webhook and subscribe bot
  // CRITICAL: If this fails, we must delete the bot to ensure consistency
  let webhookRegistrationSucceeded = false;
  let webhookErrorMessage = '';

  try {
    console.log('');
    console.log('================================================================================');
    console.log('=== WEBHOOK REGISTRATION PROCESS ===');
    console.log('================================================================================');
    console.log('   Project ID:', project.id);
    console.log('   Project Name:', project.name);
    console.log('   Bot Username:', savedBot.username);
    console.log('   Bot User ID:', savedBot.userId);
    console.log('');

    console.log('📋 Credential validation:');
    console.log('   API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ MISSING');
    console.log('   API Secret:', apiSecret ? '✅ Present' : '❌ MISSING');
    console.log('   Bearer Token:', bearerToken ? `${bearerToken.substring(0, 20)}...` : '❌ MISSING');
    console.log('   Webhook Env:', webhookEnv);
    console.log('');

    if (!bearerToken || !apiKey || !apiSecret) {
      console.error('❌ FATAL: Missing required credentials for webhook setup');
      console.error('   Bearer Token:', bearerToken ? 'Present' : 'MISSING');
      console.error('   API Key:', apiKey ? 'Present' : 'MISSING');
      console.error('   API Secret:', apiSecret ? 'Present' : 'MISSING');
      throw new Error('Missing required credentials for webhook setup');
    }

    // CRITICAL: Always use the shared webhook URL for looking up and subscribing.
    // Individual TwitterApps don't have their own webhooks - they all share the main one.
    // The webhook handler routes events by for_user_id, not by webhook URL.
    const webhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter`;
    console.log('📍 Webhook URL:', webhookUrl);

    // Check if webhook already exists in DB
    console.log('🔍 Checking for existing webhook registration in database...');
    const existingWebhooks = await getWebhookRegistrationsByProjectId(project.id);
    console.log(`   Found ${existingWebhooks.length} existing webhook(s) for this project`);

    let webhookId: string | null = null;
    const existingWebhook = existingWebhooks.find(w => w.url === webhookUrl);

    if (existingWebhook) {
      console.log('✅ Found existing webhook registration in database');
      console.log('   Webhook ID:', existingWebhook.webhookId);
      webhookId = existingWebhook.webhookId;
    } else {
      // Check Twitter API for existing webhook
      console.log('🔍 Checking Twitter for existing webhook...');
      try {
        const twitterWebhooks = await listWebhooks(bearerToken, webhookEnv);
        console.log(`   Found ${twitterWebhooks.length} webhook(s) in Twitter`);

        const matchingWebhook = twitterWebhooks.find(w => w.url === webhookUrl);
        if (matchingWebhook) {
          console.log('✅ Found existing webhook in Twitter:', matchingWebhook.id);
          await saveWebhookRegistration(project.id, {
            webhookId: matchingWebhook.id,
            url: matchingWebhook.url,
            subscribed: false,
          });
          webhookId = matchingWebhook.id;
        }
      } catch (listError: any) {
        console.log('⚠️  Could not list webhooks:', listError.message);
        console.log('   Will attempt to register new webhook');
      }
    }

    // Register new webhook if doesn't exist
    let needsSubscription = true;
    if (!webhookId) {
      console.log('🔧 Registering new webhook with Twitter...');
      console.log('   Calling registerWebhook() with:');
      console.log('     URL:', webhookUrl);
      console.log('     API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
      console.log('     API Secret:', apiSecret ? 'Present' : 'MISSING');
      console.log('     Webhook Env:', webhookEnv);
      console.log('     Bearer Token:', bearerToken ? `${bearerToken.substring(0, 20)}...` : 'MISSING');
      console.log('');

      try {
        const result = await registerWebhook(webhookUrl, apiKey, apiSecret, webhookEnv, bearerToken);
        webhookId = result.webhookId;
        console.log('✅ Webhook registered in Twitter:', webhookId);
        console.log('   Returned URL:', result.url);
        await saveWebhookRegistration(project.id, {
          webhookId: webhookId,
          url: result.url,
          subscribed: false,
        });
        console.log('   ✅ Webhook saved to database');
      } catch (regError: any) {
        console.error('❌ Webhook registration failed!');
        console.error('   Error type:', regError.constructor.name);
        console.error('   Error message:', regError.message);
        console.error('   Stack trace:', regError.stack);
        throw regError;
      }
    }

    if (!webhookId) {
      throw new Error('Failed to obtain webhook ID - cannot subscribe bot');
    }

    // Subscribe bot to webhook
    if (needsSubscription) {
      console.log('📌 Subscribing bot to webhook...');

      await subscribeWebhook(
        apiKey,
        apiSecret,
        accessToken,
        accessSecret,
        webhookId,
        user.data.id,
        bearerToken,
        webhookEnv
      );
      console.log('   ✅ Subscription successful');

      // Update subscription status
      await saveWebhookRegistration(project.id, {
        webhookId: webhookId,
        url: webhookUrl,
        subscribed: true,
      });
    }

    webhookRegistrationSucceeded = true;
    console.log('');
    console.log('================================================================================');
    console.log('✅ WEBHOOK REGISTRATION COMPLETE');
    console.log('   Bot:', savedBot.username);
    console.log('   Webhook URL:', webhookUrl);
    console.log('================================================================================');
    console.log('');
  } catch (webhookError: any) {
    webhookErrorMessage = webhookError.message || 'Unknown error';

    console.error('');
    console.error('================================================================================');
    console.error('❌ WEBHOOK REGISTRATION FAILED');
    console.error('   Error:', webhookErrorMessage);
    console.error('🔄 ROLLING BACK BOT CONNECTION');

    try {
      const { deleteBotByProjectId } = await import('@/lib/db/bots');
      await deleteBotByProjectId(project.id);
      console.error('   ✅ Bot deleted successfully');
    } catch (deleteError: any) {
      console.error('   ❌ Failed to delete bot:', deleteError.message);
    }

    console.error('================================================================================');

    throw new Error(
      `Webhook registration failed: ${webhookErrorMessage}. Please try connecting the bot again.`
    );
  }

  // Clear cookies and redirect
  const redirectUrl = projectIdFromCookie
    ? `/dashboard/projects/${project.id}?success=bot_connected`
    : '/dashboard?success=bot_connected';

  console.log('✅ Redirecting to:', redirectUrl);

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  clearOAuthCookies(response);

  return response;
}

/**
 * Clear all OAuth-related cookies
 */
function clearOAuthCookies(response: NextResponse) {
  // OAuth 1.0a cookies
  response.cookies.delete('oauth_token');
  response.cookies.delete('oauth_token_secret');

  // OAuth 2.0 cookies
  response.cookies.delete('oauth2_state');
  response.cookies.delete('oauth2_code_verifier');
  response.cookies.delete('oauth_version');

  // Common cookies
  response.cookies.delete('oauth_project_id');
  response.cookies.delete('oauth_twitter_app_id');
}
