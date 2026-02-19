import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById, deleteProject } from '@/lib/db/projects';
import { unsubscribeWebhook, deleteWebhook } from '@/lib/twitter/webhooks';
import { getBotByProjectId } from '@/lib/db/bots';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';

/**
 * GET: Get a specific project with all its data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error getting project:', error);
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a project and clean up all its resources
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log('');
    console.log('=== PROJECT DELETION STARTED ===');
    console.log('🗑️  Deleting project:', project.name, `(${project.id})`);

    // Clean up webhooks if bot is connected
    let bot = null;
    try {
      bot = await getBotByProjectId(id);
      const webhooks = await getWebhookRegistrationsByProjectId(id);
      const subscribedWebhook = webhooks.find(w => w.subscribed);

      if (subscribedWebhook && bot) {
        console.log('📍 Cleaning up webhooks...');

        // Get credentials from TwitterApp (DB) or fall back to env vars
        let bearerToken: string | undefined;
        let consumerKey: string | undefined;
        let consumerSecret: string | undefined;
        let webhookEnv: string = process.env.TWITTER_WEBHOOK_ENV || 'production';
        const twitterApp = await getTwitterAppByProjectId(id);
        if (twitterApp) {
          bearerToken = twitterApp.bearerToken;
          consumerKey = twitterApp.consumerKey;
          consumerSecret = twitterApp.consumerSecret;
          webhookEnv = twitterApp.webhookEnv;
          console.log('🔑 Using credentials from TwitterApp DB:', twitterApp.name, '| env:', webhookEnv);
        } else {
          bearerToken = process.env.X_API_BEARER_TOKEN;
          consumerKey = process.env.TWITTER_OAUTH_API_KEY;
          consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;
          webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
          console.log('🔑 Using credentials from env vars (fallback) | env:', webhookEnv);
        }

        if (bearerToken && consumerKey && consumerSecret) {
          // Unsubscribe bot using Bearer Token
          await unsubscribeWebhook(
            subscribedWebhook.webhookId,
            bot.userId,
            bearerToken,
            webhookEnv
          );
          console.log('✅ Bot unsubscribed from webhook');

          // Delete webhook from Twitter (app-level OAuth 1.0a)
          // Skip if using the shared main webhook (by ID placeholder or by URL pattern)
          const isSharedWebhook = subscribedWebhook.webhookId === 'env-var-webhook'
            || subscribedWebhook.url.endsWith('/api/webhooks/twitter');
          if (isSharedWebhook) {
            console.log('⏭️  Skipping webhook deletion: shared main webhook (only unsubscribed)');
          } else {
            await deleteWebhook(subscribedWebhook.webhookId, consumerKey, consumerSecret, webhookEnv);
            console.log('✅ Webhook deleted from Twitter');
          }
        } else {
          console.error('❌ Credentials not found - cannot clean up webhook subscription');
          throw new Error('Credentials not configured. Associate a Twitter App with this project.');
        }

        // Delete webhook registrations from database
        await deleteAllWebhookRegistrationsForProject(id);
        console.log('✅ Webhook registrations deleted from database');
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
      console.error('   This may leave an orphaned subscription in Twitter');
      if (bot) {
        console.error('   You can manually clean it up using: node scripts/delete-orphaned-subscriptions.mjs', bot.userId);
      }
      // Continue anyway - project will still be deleted
    }

    // Delete project (cascades to bot, forwarding config, and webhook registrations)
    await deleteProject(id);

    console.log('✅ Project deleted successfully');
    console.log('=== PROJECT DELETION FINISHED ===');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
