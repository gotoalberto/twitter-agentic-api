import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getOrCreateDefaultProject } from '@/lib/db/projects';
import { saveBot } from '@/lib/db/bots';
import { registerWebhook, subscribeWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { saveWebhookRegistration, getWebhookRegistrationsByProjectId } from '@/lib/db/webhooks';

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

    // Get project ID from cookie (if coming from multi-project flow)
    // or use default project for backward compatibility
    const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
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
      // Backward compatibility: use default project
      project = await getOrCreateDefaultProject();
      console.log('📦 Using default project:', project.name, `(${project.id})`);
    }

    // Save bot to PostgreSQL with encrypted tokens
    await saveBot(project.id, {
      userId: user.data.id,
      username: user.data.username,
      accessToken,
      accessTokenSecret: accessSecret,
    });

    console.log('💾 Bot saved to database');

    // Register webhook and subscribe bot
    try {
      console.log('');
      console.log('=== WEBHOOK REGISTRATION ===');

      const bearerToken = process.env.X_API_BEARER_TOKEN;
      const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
      const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

      if (!bearerToken || !consumerKey || !consumerSecret) {
        throw new Error('Missing required environment variables for webhook setup');
      }

      // Construct webhook URL
      const webhookUrl = `${new URL(request.url).origin}/api/webhooks/twitter`;
      console.log('📍 Webhook URL:', webhookUrl);

      // Check if webhook already exists with this URL
      const existingWebhooks = await getWebhookRegistrationsByProjectId(project.id);
      let webhook = existingWebhooks.find(w => w.url === webhookUrl);

      if (!webhook) {
        // List webhooks to see if one already exists in Twitter
        try {
          const twitterWebhooks = await listWebhooks(bearerToken);
          const matchingWebhook = twitterWebhooks.find(w => w.url === webhookUrl);

          if (matchingWebhook) {
            console.log('✅ Found existing webhook in Twitter:', matchingWebhook.id);
            // Save to database
            await saveWebhookRegistration(project.id, {
              webhookId: matchingWebhook.id,
              url: matchingWebhook.url,
              subscribed: false,
            });
            webhook = await getWebhookRegistrationsByProjectId(project.id).then(whs => whs.find(w => w.webhookId === matchingWebhook.id));
          }
        } catch (listError: any) {
          console.log('⚠️  Could not list webhooks:', listError.message);
        }
      }

      // Register new webhook if doesn't exist
      if (!webhook) {
        console.log('🔧 Registering new webhook...');
        const { webhookId, url } = await registerWebhook(webhookUrl, bearerToken);

        // Save to database
        await saveWebhookRegistration(project.id, {
          webhookId,
          url,
          subscribed: false,
        });

        console.log('✅ Webhook registered:', webhookId);

        // Get the webhook we just saved
        webhook = await getWebhookRegistrationsByProjectId(project.id).then(whs => whs.find(w => w.webhookId === webhookId));
      }

      if (webhook) {
        // Subscribe bot to webhook
        console.log('📌 Subscribing bot to webhook...');
        await subscribeWebhook(consumerKey, consumerSecret, accessToken, accessSecret, webhook.webhookId);

        // Update subscription status
        await saveWebhookRegistration(project.id, {
          webhookId: webhook.webhookId,
          url: webhook.url,
          subscribed: true,
        });

        console.log('✅ Bot subscribed to webhook');
      }

      console.log('=== WEBHOOK REGISTRATION COMPLETE ===');
      console.log('');
    } catch (webhookError: any) {
      console.error('⚠️  Webhook setup failed (non-fatal):', webhookError.message);
      console.error(webhookError);
      // Continue anyway - bot is connected, webhook can be set up later
    }

    // Clear cookies and redirect
    // If projectId was in cookie, redirect to project detail page
    // Otherwise redirect to main dashboard (backward compatibility)
    const redirectUrl = projectIdFromCookie
      ? `/dashboard/projects/${project.id}?success=bot_connected`
      : '/dashboard?success=bot_connected';

    const response = NextResponse.redirect(
      new URL(redirectUrl, request.url)
    );

    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');
    response.cookies.delete('oauth_project_id');

    return response;
  } catch (error: any) {
    console.error('=== BOT OAUTH CALLBACK ERROR ===');
    console.error('Error:', error);

    // Try to get projectId from cookie for error redirect
    const projectIdFromCookie = request.cookies.get('oauth_project_id')?.value;
    const errorRedirectUrl = projectIdFromCookie
      ? `/dashboard/projects/${projectIdFromCookie}?error=${encodeURIComponent(error.message || 'oauth_failed')}`
      : `/dashboard?error=${encodeURIComponent(error.message || 'oauth_failed')}`;

    const response = NextResponse.redirect(
      new URL(errorRedirectUrl, request.url)
    );

    response.cookies.delete('oauth_token');
    response.cookies.delete('oauth_token_secret');
    response.cookies.delete('oauth_project_id');

    return response;
  }
}
