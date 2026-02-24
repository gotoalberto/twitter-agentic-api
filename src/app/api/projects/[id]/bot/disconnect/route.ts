import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId, deleteBotByProjectId, updateBot } from '@/lib/db/bots';
import { unsubscribeWebhook } from '@/lib/twitter/webhooks';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';

/**
 * POST: Disconnect bot OAuth from a specific project
 *
 * Request body:
 * {
 *   "type": "oauth1" | "oauth2" | "all"  // Which OAuth to disconnect
 * }
 *
 * - oauth1: Remove OAuth 1.0a credentials (accessToken, accessTokenSecret)
 * - oauth2: Remove OAuth 2.0 credentials (oauth2AccessToken, refreshToken, etc.)
 * - all: Remove all credentials and delete bot entirely
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
    const body = await request.json();
    const disconnectType = body.type || 'all'; // Default to 'all' for backward compatibility

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
    console.log('🔧 Disconnect type:', disconnectType);

    // Handle different disconnect types
    if (disconnectType === 'oauth1') {
      // Remove OAuth 1.0a credentials only
      console.log('🔑 Removing OAuth 1.0a credentials...');

      // If OAuth 1.0a is used for webhooks, unsubscribe first
      if (bot.accessToken) {
        try {
          const webhooks = await getWebhookRegistrationsByProjectId(projectId);
          const subscribedWebhook = webhooks.find(w => w.subscribed);

          if (subscribedWebhook) {
            console.log('📍 Unsubscribing from webhook (OAuth 1.0a required)...');
            const twitterApp = await getTwitterAppByProjectId(projectId);
            if (twitterApp?.bearerToken) {
              await unsubscribeWebhook(
                subscribedWebhook.webhookId,
                bot.userId,
                twitterApp.bearerToken,
                twitterApp.webhookEnv
              );
              await deleteAllWebhookRegistrationsForProject(projectId);
              console.log('✅ Webhook unsubscribed');
            }
          }
        } catch (error: any) {
          console.error('⚠️ Webhook unsubscribe failed:', error.message);
        }
      }

      await updateBot(bot.id, {
        accessToken: undefined,
        accessTokenSecret: undefined,
      });

      console.log('✅ OAuth 1.0a credentials removed');
      return NextResponse.json({
        success: true,
        message: 'OAuth 1.0a disconnected successfully',
        type: 'oauth1'
      });

    } else if (disconnectType === 'oauth2') {
      // Remove OAuth 2.0 credentials only
      console.log('🔑 Removing OAuth 2.0 credentials...');

      await updateBot(bot.id, {
        oauth2AccessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
        scope: undefined,
      });

      console.log('✅ OAuth 2.0 credentials removed');
      return NextResponse.json({
        success: true,
        message: 'OAuth 2.0 disconnected successfully',
        type: 'oauth2'
      });

    } else if (disconnectType === 'all') {
      // Remove everything - original behavior
      console.log('🗑️ Removing all credentials and bot...');

      // Unsubscribe bot from webhook
      try {
        const webhooks = await getWebhookRegistrationsByProjectId(projectId);
        const subscribedWebhook = webhooks.find(w => w.subscribed);

        if (subscribedWebhook) {
          console.log('📍 Unsubscribing bot from webhook...');

          // Get credentials from TwitterApp (DB) or fall back to env vars
          let bearerToken: string | undefined;
          let webhookEnv: string = process.env.TWITTER_WEBHOOK_ENV || 'production';
          const twitterApp = await getTwitterAppByProjectId(projectId);
          if (twitterApp) {
            bearerToken = twitterApp.bearerToken;
            webhookEnv = twitterApp.webhookEnv;
            console.log('🔑 Using credentials from TwitterApp DB:', twitterApp.name, '| env:', webhookEnv);
          } else {
            bearerToken = process.env.X_API_BEARER_TOKEN;
            webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
            console.log('🔑 Using credentials from env vars (fallback) | env:', webhookEnv);
          }

          if (bearerToken) {
            await unsubscribeWebhook(
              subscribedWebhook.webhookId,
              bot.userId,
              bearerToken,
              webhookEnv
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

      console.log('✅ Bot disconnected completely');
      console.log('=== BOT DISCONNECT FINISHED ===');
      console.log('');

      return NextResponse.json({
        success: true,
        message: 'Bot disconnected completely',
        type: 'all'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid disconnect type. Use: oauth1, oauth2, or all' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error disconnecting bot:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
