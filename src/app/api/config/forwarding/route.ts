import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getOrCreateDefaultProject } from '@/lib/db/projects';
import { getBotByProjectId } from '@/lib/db/bots';
import {
  getForwardingConfig,
  saveForwardingConfig as saveForwardingConfigDb,
  deleteForwardingConfig as deleteForwardingConfigDb
} from '@/lib/db/forwarding';
import { registerWebhook, subscribeWebhook, unsubscribeWebhook, deleteWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import {
  getWebhookRegistrationsByProjectId,
  saveWebhookRegistration,
  deleteAllWebhookRegistrationsForProject
} from '@/lib/db/webhooks';

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

    // Get or create default project
    const project = await getOrCreateDefaultProject();
    const config = await getForwardingConfig(project.id);

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

    // Get or create default project
    const project = await getOrCreateDefaultProject();

    // Get existing webhook registrations and forwarding config
    const existingWebhooks = await getWebhookRegistrationsByProjectId(project.id);
    const existingConfig = await getForwardingConfig(project.id);
    const existingWebhook = existingWebhooks.find(w => w.subscribed);

    // Check if endpoint changed - if so, delete old webhooks
    if (existingWebhook && existingConfig && existingConfig.endpoint !== endpoint) {
      console.log('');
      console.log('=== ENDPOINT CHANGED - DELETING OLD WEBHOOK ===');
      console.log('   Old endpoint:', existingConfig.endpoint);
      console.log('   New endpoint:', endpoint);

      try {
        const bearerToken = process.env.X_API_BEARER_TOKEN;
        if (bearerToken && existingWebhook.webhookId) {
          await deleteWebhook(existingWebhook.webhookId, bearerToken);
          await deleteAllWebhookRegistrationsForProject(project.id);
          console.log('✅ Old webhook deleted');
        }
      } catch (error: any) {
        console.error('⚠️  Failed to delete old webhook:', error.message);
        // Continue anyway
      }
    }

    // Save forwarding configuration
    await saveForwardingConfigDb(project.id, {
      endpoint,
      enabled: enabled !== false, // Default to true
    });

    // Register webhook with Twitter if bot is connected
    const bot = await getBotByProjectId(project.id);
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
              // Save to database
              await saveWebhookRegistration(project.id, {
                webhookId: matchingWebhook.id,
                url: matchingWebhook.url,
                subscribed: false,
              });
            }
          } catch (error: any) {
            console.log('⚠️  Could not list webhooks:', error.message);
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

          // Get the webhook we just saved
          const savedWebhooks = await getWebhookRegistrationsByProjectId(project.id);
          webhook = savedWebhooks.find(w => w.webhookId === webhookId);
        }

        if (webhook) {
          // Subscribe bot to webhook
          console.log('📌 Subscribing bot to webhook...');
          await subscribeWebhook(
            consumerKey,
            consumerSecret,
            bot.accessToken,
            bot.accessTokenSecret,
            webhook.webhookId,
            bot.userId,    // userId for unsubscribe if needed
            bearerToken    // bearerToken for unsubscribe if needed
          );

          // Update subscription status
          await saveWebhookRegistration(project.id, {
            webhookId: webhook.webhookId,
            url: webhook.url,
            subscribed: true,
          });
        }

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

    // Get or create default project
    const project = await getOrCreateDefaultProject();

    // Delete webhook from Twitter if exists
    const webhooks = await getWebhookRegistrationsByProjectId(project.id);
    const subscribedWebhook = webhooks.find(w => w.subscribed);

    if (subscribedWebhook) {
      console.log('');
      console.log('=== DELETING WEBHOOK ===');
      console.log('   Webhook ID:', subscribedWebhook.webhookId);

      try {
        const bearerToken = process.env.X_API_BEARER_TOKEN;
        const bot = await getBotByProjectId(project.id);

        // Unsubscribe bot if subscribed
        if (bot && bearerToken) {
          console.log('📍 Unsubscribing bot from webhook...');
          await unsubscribeWebhook(subscribedWebhook.webhookId, bot.userId, bearerToken);
          console.log('✅ Bot unsubscribed');
        }

        // Delete webhook
        if (bearerToken) {
          await deleteWebhook(subscribedWebhook.webhookId, bearerToken);
          console.log('✅ Webhook deleted from Twitter');
        }

        // Delete from database
        await deleteAllWebhookRegistrationsForProject(project.id);
        console.log('✅ Webhook registrations deleted from database');
      } catch (error: any) {
        console.error('⚠️  Failed to delete webhook:', error.message);
        // Continue anyway to delete config
      }

      console.log('=== WEBHOOK DELETION COMPLETE ===');
      console.log('');
    }

    // Delete forwarding configuration
    await deleteForwardingConfigDb(project.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to delete forwarding configuration' },
      { status: 500 }
    );
  }
}
