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

        // Get credentials from TwitterApp
        const twitterApp = await getTwitterAppByProjectId(id);
        if (!twitterApp) {
          console.error('❌ Project has no TwitterApp - cannot clean up webhook subscription');
          console.error('   Webhook may remain orphaned in Twitter');
          console.error('   Manual cleanup required');
        } else {
          const bearerToken = twitterApp.bearerToken;
          const consumerKey = twitterApp.consumerKey;
          const consumerSecret = twitterApp.consumerSecret;
          const webhookEnv = twitterApp.webhookEnv;
          console.log('🔑 Using credentials from TwitterApp:', twitterApp.name, '| env:', webhookEnv);

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
            // Only delete webhook if we have OAuth 1.0a credentials
            if (consumerKey && consumerSecret) {
              await deleteWebhook(subscribedWebhook.webhookId, consumerKey, consumerSecret, webhookEnv, bearerToken);
              console.log('✅ Webhook deleted from Twitter');
            } else {
              console.log('⚠️  Cannot delete webhook - OAuth 1.0a credentials not configured');
            }
          }
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
