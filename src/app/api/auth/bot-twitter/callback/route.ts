import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getOrCreateDefaultProject } from '@/lib/db/projects';
import { saveBot } from '@/lib/db/bots';
import { registerWebhook, subscribeWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { saveWebhookRegistration, getWebhookRegistrationsByProjectId } from '@/lib/db/webhooks';
import { getTwitterAppById } from '@/lib/db/twitter-apps';

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

    // Get project ID and optionally the twitterAppId from cookies
    const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
    const twitterAppIdFromCookie = request.cookies.get('oauth_twitter_app_id')?.value;

    // Resolve credentials: from DB TwitterApp or env vars fallback
    let apiKey: string | undefined;
    let apiSecret: string | undefined;
    let bearerToken: string | undefined;
    let webhookEnv: string = process.env.TWITTER_WEBHOOK_ENV || 'production';
    let resolvedTwitterAppId: string | undefined;

    if (twitterAppIdFromCookie) {
      const twitterApp = await getTwitterAppById(twitterAppIdFromCookie);
      if (twitterApp) {
        apiKey = twitterApp.consumerKey;
        apiSecret = twitterApp.consumerSecret;
        bearerToken = twitterApp.bearerToken;
        webhookEnv = twitterApp.webhookEnv;
        resolvedTwitterAppId = twitterApp.id;
        console.log('🔑 Using credentials from TwitterApp DB:', twitterApp.name, '| env:', webhookEnv);
      }
    }

    // Fall back to env vars if no TwitterApp configured
    if (!apiKey || !apiSecret || !bearerToken) {
      apiKey = process.env.TWITTER_OAUTH_API_KEY;
      apiSecret = process.env.TWITTER_OAUTH_API_SECRET;
      bearerToken = process.env.X_API_BEARER_TOKEN;
      webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
      console.log('🔑 Using credentials from env vars (fallback) | env:', webhookEnv);
    }

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

    // Resolve project
    let project;
    if (projectIdFromCookie) {
      const { getProjectById } = await import('@/lib/db/projects');
      project = await getProjectById(projectIdFromCookie);
      if (!project) {
        console.error('❌ Project not found:', projectIdFromCookie);
        return NextResponse.redirect(
          new URL('/dashboard?error=project_not_found', request.url)
        );
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

      if (!bearerToken || !apiKey || !apiSecret) {
        throw new Error('Missing required credentials for webhook setup');
      }

      // Webhook URL: per-app if we have a twitterAppId, else legacy URL
      let webhookUrl: string;
      if (resolvedTwitterAppId) {
        webhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter/${resolvedTwitterAppId}`;
      } else {
        webhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter`;
      }
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
        let registrationError: any = null;
        try {
          const result = await registerWebhook(webhookUrl, apiKey!, apiSecret!, webhookEnv);
          webhookId = result.webhookId;
          console.log('✅ Webhook registered in Twitter:', webhookId);
          await saveWebhookRegistration(project.id, {
            webhookId: webhookId,
            url: result.url,
            subscribed: false,
          });
        } catch (regError: any) {
          registrationError = regError;
          console.log('⚠️  Webhook registration failed:', regError.message);
        }

        // If registration failed with 403 and we used a TwitterApp, fall back to env-var webhook
        if (registrationError) {
          const is403 = registrationError.message?.toLowerCase().includes('403') ||
            registrationError.message?.toLowerCase().includes('forbidden');

          if (is403 && resolvedTwitterAppId) {
            console.log('');
            console.log('🔄 FALLBACK: TwitterApp has no TAAS management access (403)');
            console.log('   Attempting to subscribe bot to env-var webhook instead...');

            const envApiKey = process.env.TWITTER_OAUTH_API_KEY;
            const envApiSecret = process.env.TWITTER_OAUTH_API_SECRET;
            const envBearerToken = process.env.X_API_BEARER_TOKEN;
            const envWebhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
            const envWebhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter`;

            if (envApiKey && envApiSecret && envBearerToken) {
              console.log('✅ Env-var credentials available, subscribing bot...');
              await subscribeWebhook(
                envApiKey,
                envApiSecret,
                accessToken,
                accessSecret,
                'env-var-webhook',
                user.data.id,
                envBearerToken,
                envWebhookEnv
              );
              console.log('   ✅ Bot subscribed to env-var webhook');

              await saveWebhookRegistration(project.id, {
                webhookId: 'env-var-webhook',
                url: envWebhookUrl,
                subscribed: true,
              });

              webhookId = 'env-var-webhook';
              needsSubscription = false; // Already subscribed in fallback
              console.log('');
              console.log('================================================================================');
              console.log('✅ WEBHOOK SETUP COMPLETE (env-var fallback)');
              console.log('   Bot:', savedBot.username);
              console.log('   Webhook URL:', envWebhookUrl);
              console.log('   Note: TwitterApp has no TAAS management access; using env-var webhook.');
              console.log('   Events will be routed by for_user_id to the correct project.');
              console.log('================================================================================');
              console.log('');
            } else {
              console.log('❌ No env-var credentials for fallback');
              throw registrationError;
            }
          } else {
            throw registrationError;
          }
        }
      }

      if (!webhookId) {
        throw new Error('Failed to obtain webhook ID - cannot subscribe bot');
      }

      // Subscribe bot to webhook (skipped if already done via fallback)
      if (needsSubscription) {
        console.log('📌 Subscribing bot to webhook...');
        await subscribeWebhook(
          apiKey!,
          apiSecret!,
          accessToken,
          accessSecret,
          webhookId,
          user.data.id,
          bearerToken!,
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
    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');
    response.cookies.delete('oauth_project_id');
    response.cookies.delete('oauth_twitter_app_id');

    return response;
  } catch (error: any) {
    console.error('=== BOT OAUTH CALLBACK ERROR ===');
    console.error('Error:', error);

    const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
    const errorRedirectUrl = projectIdFromCookie
      ? `/dashboard/projects/${projectIdFromCookie}?error=${encodeURIComponent(error.message || 'oauth_failed')}`
      : `/dashboard?error=${encodeURIComponent(error.message || 'oauth_failed')}`;

    const response = NextResponse.redirect(new URL(errorRedirectUrl, request.url));
    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');
    response.cookies.delete('oauth_project_id');
    response.cookies.delete('oauth_twitter_app_id');

    return response;
  }
}
