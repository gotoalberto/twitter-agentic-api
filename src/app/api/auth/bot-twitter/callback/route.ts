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
        // CRITICAL: Always use env-var bearer token to list webhooks, because the shared
        // webhook (id=1999190094972911617) is registered with the env-var app, not TwitterApp apps.
        console.log('🔍 Checking Twitter for existing webhook...');
        try {
          const envVarBearerToken = process.env.X_API_BEARER_TOKEN;
          if (!envVarBearerToken) {
            throw new Error('X_API_BEARER_TOKEN not configured');
          }
          const twitterWebhooks = await listWebhooks(envVarBearerToken, webhookEnv);
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

        // Registration failed. If it's a permission error, try subscribing directly
        // to the env-var webhook (which is known to be active, since events flow through it).
        //
        // Two scenarios:
        //  A) resolvedTwitterAppId is set  → was using TwitterApp creds → switch to env-var
        //  B) resolvedTwitterAppId is null → already using env-var creds → subscribe directly
        //
        // Triggers on: 403 Forbidden, "Application cannot perform write actions" (code 261),
        // or any similar Twitter permission/access restriction.
        if (registrationError) {
          const msg = registrationError.message?.toLowerCase() || '';
          const isPermissionError = msg.includes('403') ||
            msg.includes('forbidden') ||
            msg.includes('cannot perform write') ||
            msg.includes('contact twitter platform') ||
            msg.includes('application cannot');

          if (isPermissionError) {
            // Determine which credentials to use for subscription
            let subApiKey: string | undefined;
            let subApiSecret: string | undefined;
            let subBearerToken: string | undefined;
            let subWebhookEnv: string;
            let subWebhookUrl: string;

            if (resolvedTwitterAppId) {
              // Scenario A: switch to env-var credentials
              subApiKey = process.env.TWITTER_OAUTH_API_KEY;
              subApiSecret = process.env.TWITTER_OAUTH_API_SECRET;
              subBearerToken = process.env.X_API_BEARER_TOKEN;
              subWebhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
              subWebhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter`;
              console.log('');
              console.log('🔄 FALLBACK A: TwitterApp cannot register webhook (permission error)');
              console.log('   Error was:', registrationError.message);
              console.log('   Switching to env-var credentials for subscription...');
            } else {
              // Scenario B: already on env-var — subscribe directly (webhook exists)
              subApiKey = apiKey!;
              subApiSecret = apiSecret!;
              subBearerToken = bearerToken!;
              subWebhookEnv = webhookEnv;
              subWebhookUrl = webhookUrl;
              console.log('');
              console.log('🔄 FALLBACK B: Registration failed (env-var), trying subscription directly');
              console.log('   Error was:', registrationError.message);
              console.log('   The env-var webhook is active — attempting direct subscription...');
            }

            if (subApiKey && subApiSecret && subBearerToken) {
              // Discover real webhook ID via v2 list (v2 list works for this app)
              let realWebhookId: string = 'env-var-webhook'; // placeholder fallback
              try {
                const discoveredWebhooks = await listWebhooks(subBearerToken, subWebhookEnv);
                const foundWebhook = discoveredWebhooks.find(w => w.url === subWebhookUrl);
                if (foundWebhook) {
                  realWebhookId = foundWebhook.id;
                  console.log('   Found real webhook ID via v2 list:', realWebhookId);
                } else {
                  console.log('   ⚠️ Webhook not found in v2 list for URL:', subWebhookUrl);
                  console.log('   Available webhooks:', discoveredWebhooks.map(w => w.url));
                }
              } catch (listErr: any) {
                console.log('   ⚠️ Could not discover webhook ID:', listErr.message);
              }

              try {
                await subscribeWebhook(
                  subApiKey,
                  subApiSecret,
                  accessToken,
                  accessSecret,
                  realWebhookId,
                  user.data.id,
                  subBearerToken,
                  subWebhookEnv
                );
                console.log('   ✅ Bot subscribed to webhook:', realWebhookId);

                await saveWebhookRegistration(project.id, {
                  webhookId: realWebhookId,
                  url: subWebhookUrl,
                  subscribed: true,
                });

                webhookId = realWebhookId;
                needsSubscription = false;
                console.log('');
                console.log('================================================================================');
                console.log('✅ WEBHOOK SETUP COMPLETE (env-var fallback)');
                console.log('   Bot:', savedBot.username);
                console.log('   Webhook URL:', subWebhookUrl);
                console.log('   Events will be routed by for_user_id to the correct project.');
                console.log('================================================================================');
                console.log('');
              } catch (subError: any) {
                // "Could not authenticate you" (error 32) means bot tokens are bound to
                // the TwitterApp and cannot be used with env-var consumer credentials.
                // Restart OAuth with force_env_var=true so tokens match env-var app.
                const subMsg = subError.message?.toLowerCase() || '';
                const isTokenMismatch = subMsg.includes('authenticate') ||
                  subMsg.includes('could not authenticate') ||
                  subMsg.includes(': 32') ||
                  subMsg.includes('error 32');

                if (isTokenMismatch && resolvedTwitterAppId && projectIdFromCookie) {
                  console.log('');
                  console.log('🔄 TOKEN MISMATCH: Bot tokens are bound to TwitterApp, not env-var app.');
                  console.log('   Restarting OAuth with force_env_var=true...');

                  try {
                    const { deleteBotByProjectId } = await import('@/lib/db/bots');
                    await deleteBotByProjectId(project.id);
                    console.log('   ✅ Bot rolled back');
                  } catch (deleteErr: any) {
                    console.error('   ⚠️  Failed to rollback bot:', deleteErr.message);
                  }

                  const retryUrl = `${new URL(request.url).origin}/api/projects/${projectIdFromCookie}/bot/authorize?force_env_var=true`;
                  console.log('   Retry URL:', retryUrl);

                  const retryResponse = NextResponse.redirect(retryUrl);
                  retryResponse.cookies.delete('oauth_token');
                  retryResponse.cookies.delete('oauth_token_secret');
                  retryResponse.cookies.delete('oauth_project_id');
                  retryResponse.cookies.delete('oauth_twitter_app_id');
                  return retryResponse;
                }

                // Other subscription errors — surface to the user
                console.error('   ❌ Subscription also failed:', subError.message);
                throw subError;
              }
            } else {
              console.log('❌ No credentials available for subscription fallback');
              throw registrationError;
            }
          } else {
            // Not a permission error — surface it directly
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

        // CRITICAL FIX: If using the shared webhook (1999190094972911617) but have TwitterApp credentials,
        // we must use env-var credentials for subscription because the webhook belongs to the env-var app
        const isSharedWebhook = webhookId === '1999190094972911617' ||
                               webhookUrl === `${new URL(request.url).origin}/api/webhooks/twitter`;

        let subApiKey: string | undefined = apiKey;
        let subApiSecret: string | undefined = apiSecret;
        let subBearerToken: string | undefined = bearerToken;
        let subWebhookEnv: string = webhookEnv;

        if (isSharedWebhook && resolvedTwitterAppId) {
          console.log('⚠️  Detected shared webhook with TwitterApp credentials');
          console.log('   Switching to env-var credentials for subscription...');
          subApiKey = process.env.TWITTER_OAUTH_API_KEY;
          subApiSecret = process.env.TWITTER_OAUTH_API_SECRET;
          subBearerToken = process.env.X_API_BEARER_TOKEN;
          subWebhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

          if (!subApiKey || !subApiSecret || !subBearerToken) {
            throw new Error('Env-var credentials not configured but required for shared webhook subscription');
          }
        }

        await subscribeWebhook(
          subApiKey!,
          subApiSecret!,
          accessToken,
          accessSecret,
          webhookId,
          user.data.id,
          subBearerToken!,
          subWebhookEnv
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
