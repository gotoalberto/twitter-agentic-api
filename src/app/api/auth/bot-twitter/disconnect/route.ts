import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getOrCreateDefaultProject } from '@/lib/db/projects';
import { getBotByProjectId, deleteBotByProjectId } from '@/lib/db/bots';
import { unsubscribeWebhook, deleteWebhook } from '@/lib/twitter/webhooks';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create default project
    const project = await getOrCreateDefaultProject();
    const bot = await getBotByProjectId(project.id);

    if (!bot) {
      return NextResponse.json({
        success: false,
        error: 'No bot connected',
      });
    }

    console.log('');
    console.log('=== BOT DISCONNECT STARTED ===');
    console.log('🔌 Disconnecting bot:', bot.username);
    console.log('📦 Project:', project.name);

    // Unsubscribe from webhook and delete webhook
    try {
      const webhooks = await getWebhookRegistrationsByProjectId(project.id);
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
          await deleteAllWebhookRegistrationsForProject(project.id);
        }
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
      // Continue anyway - bot will still be disconnected
    }

    // Delete bot from database
    await deleteBotByProjectId(project.id);

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
