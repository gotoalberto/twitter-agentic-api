import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId, deleteBotByProjectId } from '@/lib/db/bots';
import { unsubscribeWebhook } from '@/lib/twitter/webhooks';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';

/**
 * POST: Disconnect bot from a specific project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const bot = await getBotByProjectId(projectId);

    if (!bot) {
      return NextResponse.json({
        success: false,
        error: 'No bot connected to this project',
      });
    }

    console.log('');
    console.log('=== BOT DISCONNECT STARTED ===');
    console.log('🔌 Disconnecting bot:', bot.username);
    console.log('📦 Project:', project.name, `(${project.id})`);

    // Unsubscribe bot from webhook
    try {
      const webhooks = await getWebhookRegistrationsByProjectId(projectId);
      const subscribedWebhook = webhooks.find(w => w.subscribed);

      if (subscribedWebhook) {
        console.log('📍 Unsubscribing bot from webhook...');

        // Get bearer token from TwitterApp (DB) or fall back to env var
        let bearerToken: string | undefined;
        const twitterApp = await getTwitterAppByProjectId(projectId);
        if (twitterApp) {
          bearerToken = twitterApp.bearerToken;
          console.log('🔑 Using bearer token from TwitterApp DB:', twitterApp.name);
        } else {
          bearerToken = process.env.X_API_BEARER_TOKEN;
          console.log('🔑 Using bearer token from env vars (fallback)');
        }

        if (bearerToken) {
          await unsubscribeWebhook(
            subscribedWebhook.webhookId,
            bot.userId,
            bearerToken
          );

          console.log('✅ Bot unsubscribed from webhook');

          await deleteAllWebhookRegistrationsForProject(projectId);
        } else {
          console.error('❌ Bearer token not found - cannot unsubscribe bot');
          throw new Error('Bearer token not configured. Associate a Twitter App with this project.');
        }
      } else {
        console.log('⏭️  No subscribed webhook found, skipping unsubscribe');
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook unsubscribe failed (non-fatal):', webhookError.message);
      console.error('   This may leave an orphaned subscription in Twitter');
      console.error('   You can manually clean it up using: node scripts/delete-orphaned-subscriptions.mjs', bot.userId);
      // Continue anyway - bot will still be disconnected
    }

    // Delete bot from database
    await deleteBotByProjectId(projectId);

    console.log('✅ Bot disconnected successfully');
    console.log('=== BOT DISCONNECT FINISHED ===');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Bot disconnected successfully',
    });
  } catch (error: any) {
    console.error('Error disconnecting bot:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
