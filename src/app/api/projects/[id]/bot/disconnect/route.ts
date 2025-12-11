import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId, deleteBotByProjectId } from '@/lib/db/bots';
import { unsubscribeWebhook, deleteWebhook } from '@/lib/twitter/webhooks';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';

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

    // Unsubscribe from webhook and delete webhook
    try {
      const webhooks = await getWebhookRegistrationsByProjectId(projectId);
      const subscribedWebhook = webhooks.find(w => w.subscribed);

      if (subscribedWebhook) {
        console.log('📍 Unsubscribing bot from webhook...');

        const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
        const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;
        const bearerToken = process.env.X_API_BEARER_TOKEN;

        if (consumerKey && consumerSecret) {
          // Unsubscribe bot using OAuth 1.0a
          await unsubscribeWebhook(
            consumerKey,
            consumerSecret,
            bot.accessToken,
            bot.accessTokenSecret,
            subscribedWebhook.webhookId
          );

          console.log('✅ Bot unsubscribed from webhook');

          // Delete webhook from Twitter
          if (bearerToken) {
            console.log('🗑️  Deleting webhook from Twitter...');
            await deleteWebhook(subscribedWebhook.webhookId, bearerToken);
            console.log('✅ Webhook deleted from Twitter');
          }

          // Delete webhook registrations from database
          await deleteAllWebhookRegistrationsForProject(projectId);
        }
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
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
