import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getForwardingConfig,
  saveForwardingConfig,
  deleteForwardingConfig
} from '@/lib/twitter/config';
import { getConnectedBot } from '@/lib/twitter/bot';
import { registerWebhook, subscribeWebhook, unsubscribeWebhook, deleteWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { getWebhookRegistration, saveWebhookRegistration, deleteWebhookRegistration } from '@/lib/twitter/webhook-storage';

/**
 * GET: Get webhook forwarding configuration
 */
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

    const config = await getForwardingConfig();

    return NextResponse.json({
      configured: !!config,
      config: config || null,
    });
  } catch (error: any) {
    console.error('Error getting forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to get forwarding configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST: Save webhook forwarding configuration
 * This will register the webhook with Twitter when saving the endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { endpoint, enabled } = body;

    // Validate endpoint URL
    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Get existing webhook registration and forwarding config
    const existingWebhook = await getWebhookRegistration();
    const existingConfig = await getForwardingConfig();

    // Check if endpoint changed - if so, delete old webhook
    if (existingWebhook && existingConfig && existingConfig.endpoint !== endpoint) {
      console.log('');
      console.log('=== ENDPOINT CHANGED - DELETING OLD WEBHOOK ===');
      console.log('   Old endpoint:', existingConfig.endpoint);
      console.log('   New endpoint:', endpoint);

      try {
        const bearerToken = process.env.X_API_BEARER_TOKEN;
        if (bearerToken && existingWebhook.webhookId) {
          await deleteWebhook(existingWebhook.webhookId, bearerToken);
          await deleteWebhookRegistration();
          console.log('✅ Old webhook deleted');
        }
      } catch (error: any) {
        console.error('⚠️  Failed to delete old webhook:', error.message);
        // Continue anyway
      }
    }

    // Save forwarding configuration
    await saveForwardingConfig({
      endpoint,
      enabled: enabled !== false, // Default to true
      updatedAt: new Date().toISOString(),
    });

    // Register webhook with Twitter if bot is connected
    const bot = await getConnectedBot();
    if (bot && enabled !== false) {
      console.log('');
      console.log('=== REGISTERING WEBHOOK ===');

      try {
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
        let webhook = existingWebhook;

        if (!webhook || webhook.url !== webhookUrl) {
          // List webhooks to see if one already exists
          try {
            const webhooks = await listWebhooks(bearerToken);
            const matchingWebhook = webhooks.find(w => w.url === webhookUrl);

            if (matchingWebhook) {
              console.log('✅ Found existing webhook:', matchingWebhook.id);
              webhook = {
                webhookId: matchingWebhook.id,
                url: matchingWebhook.url,
                botUserId: bot.userId,
                botUsername: bot.username,
                subscribed: false,
                registeredAt: new Date().toISOString(),
                lastCrcCheck: null,
              };
            }
          } catch (error: any) {
            console.log('⚠️  Could not list webhooks:', error.message);
          }
        }

        // Register new webhook if doesn't exist
        if (!webhook) {
          console.log('🔧 Registering new webhook...');
          const { webhookId, url } = await registerWebhook(webhookUrl, bearerToken);

          webhook = {
            webhookId,
            url,
            botUserId: bot.userId,
            botUsername: bot.username,
            subscribed: false,
            registeredAt: new Date().toISOString(),
            lastCrcCheck: null,
          };
        }

        // Subscribe bot to webhook
        console.log('📌 Subscribing bot to webhook...');
        await subscribeWebhook(consumerKey, consumerSecret, bot.accessToken, bot.accessTokenSecret, webhook.webhookId);

        // Update subscription status and save
        webhook.subscribed = true;
        webhook.botUserId = bot.userId;
        webhook.botUsername = bot.username;
        await saveWebhookRegistration(webhook);

        console.log('✅ Webhook registered and bot subscribed');
        console.log('=== WEBHOOK SETUP COMPLETE ===');
        console.log('');
      } catch (webhookError: any) {
        console.error('⚠️  Webhook setup failed:', webhookError.message);
        console.error(webhookError);
        // Return error to user - webhook setup is critical
        return NextResponse.json(
          { error: `Failed to setup webhook: ${webhookError.message}` },
          { status: 500 }
        );
      }
    } else if (!bot) {
      console.log('⏭️  Skipping webhook registration: No bot connected');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to save forwarding configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete webhook forwarding configuration
 * This will also delete the webhook from Twitter
 */
export async function DELETE() {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete webhook from Twitter if exists
    const webhook = await getWebhookRegistration();
    if (webhook) {
      console.log('');
      console.log('=== DELETING WEBHOOK ===');
      console.log('   Webhook ID:', webhook.webhookId);

      try {
        const bearerToken = process.env.X_API_BEARER_TOKEN;
        const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
        const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;
        const bot = await getConnectedBot();

        // Unsubscribe bot if subscribed
        if (webhook.subscribed && bot && consumerKey && consumerSecret) {
          console.log('📍 Unsubscribing bot from webhook...');
          await unsubscribeWebhook(consumerKey, consumerSecret, bot.accessToken, bot.accessTokenSecret, webhook.webhookId);
          console.log('✅ Bot unsubscribed');
        }

        // Delete webhook
        if (bearerToken) {
          await deleteWebhook(webhook.webhookId, bearerToken);
          console.log('✅ Webhook deleted from Twitter');
        }

        // Delete from Redis
        await deleteWebhookRegistration();
        console.log('✅ Webhook registration deleted from Redis');
      } catch (error: any) {
        console.error('⚠️  Failed to delete webhook:', error.message);
        // Continue anyway to delete config
      }

      console.log('=== WEBHOOK DELETION COMPLETE ===');
      console.log('');
    }

    // Delete forwarding configuration
    await deleteForwardingConfig();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to delete forwarding configuration' },
      { status: 500 }
    );
  }
}
