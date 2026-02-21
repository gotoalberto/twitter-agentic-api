import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { listWebhooks, registerWebhook, subscribeWebhook } from '@/lib/twitter/webhooks';
import { saveWebhookRegistration } from '@/lib/db/webhooks';
import { decrypt } from '@/lib/utils/encryption';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
)
{
  try {
    const { id: projectId } = await params;

    // Get project with bot and TwitterApp
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bot: true,
        webhookRegistrations: true,
        twitterApp: true,
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.bot) {
      return NextResponse.json({ error: 'No bot connected to this project' }, { status: 400 });
    }

    if (!project.twitterApp) {
      return NextResponse.json({ error: 'No Twitter App configured for this project. Each project must have a Twitter App assigned.' }, { status: 400 });
    }

    const bot = project.bot;
    const twitterApp = project.twitterApp;

    // Decrypt the TwitterApp credentials
    const decryptedConsumerKey = decrypt(twitterApp.consumerKey);
    const decryptedConsumerSecret = decrypt(twitterApp.consumerSecret);
    const decryptedBearerToken = decrypt(twitterApp.bearerToken);

    // Use the TwitterApp-specific webhook URL
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twitter/${twitterApp.id}`;
    const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

    console.log('📝 Register webhook for project:', projectId);
    console.log('   TwitterApp:', twitterApp.name, '(', twitterApp.id, ')');
    console.log('   Webhook URL:', webhookUrl);

    // Check if webhook already registered
    if (project.webhookRegistrations.length > 0) {
      const existing = project.webhookRegistrations[0];

      // Try to subscribe if not already subscribed
      if (!existing.subscribed && bot.accessToken && bot.accessTokenSecret) {
        try {
          // Use decrypted bearer token from TwitterApp
          const bearerToken = decryptedBearerToken;

          await subscribeWebhook(
            decryptedConsumerKey,
            decryptedConsumerSecret,
            bot.accessToken,
            bot.accessTokenSecret,
            existing.webhookId,
            bot.userId,
            bearerToken,
            webhookEnv
          );

          // Update subscription status
          await prisma.webhookRegistration.update({
            where: { id: existing.id },
            data: { subscribed: true }
          });

          return NextResponse.json({
            success: true,
            message: 'Webhook subscription activated',
            webhookId: existing.webhookId
          });

        } catch (subError: any) {
          console.error('Failed to subscribe:', subError);
          return NextResponse.json({
            success: false,
            message: 'Webhook exists but subscription failed',
            error: subError.message,
            webhookId: existing.webhookId
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Webhook already registered',
        webhookId: existing.webhookId,
        subscribed: existing.subscribed
      });
    }

    // Use decrypted bearer token from TwitterApp
    const bearerToken = decryptedBearerToken;

    // Check if webhook already exists in Twitter
    const twitterWebhooks = await listWebhooks(bearerToken, webhookEnv);
    const sharedWebhook = twitterWebhooks.find(w => w.url === webhookUrl);

    let webhookId: string;

    if (sharedWebhook) {
      // Use existing webhook
      webhookId = sharedWebhook.id;
      console.log('Using existing webhook:', webhookId);
    } else {
      // Register new webhook with TwitterApp credentials
      try {
        const result = await registerWebhook(
          webhookUrl,
          decryptedConsumerKey,
          decryptedConsumerSecret,
          webhookEnv
        );
        webhookId = result.webhookId;
        console.log('Registered new webhook:', webhookId);
      } catch (regError: any) {
        return NextResponse.json({
          error: 'Failed to register webhook',
          details: regError.message
        }, { status: 500 });
      }
    }

    // Save webhook registration
    await saveWebhookRegistration(projectId, {
      webhookId,
      url: webhookUrl,
      subscribed: false,
    });

    // Subscribe bot to webhook
    if (bot.accessToken && bot.accessTokenSecret) {
      try {
        await subscribeWebhook(
          decryptedConsumerKey,
          decryptedConsumerSecret,
          bot.accessToken,
          bot.accessTokenSecret,
          webhookId,
          bot.userId,
          bearerToken,
          webhookEnv
        );

        // Update subscription status
        await prisma.webhookRegistration.updateMany({
          where: {
            projectId,
            webhookId
          },
          data: { subscribed: true }
        });

        return NextResponse.json({
          success: true,
          message: 'Webhook registered and subscribed successfully',
          webhookId
        });

      } catch (subError: any) {
        console.error('Subscription failed:', subError);
        return NextResponse.json({
          success: true,
          message: 'Webhook registered but subscription failed',
          error: subError.message,
          webhookId
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook registered (subscription pending)',
      webhookId
    });

  } catch (error: any) {
    console.error('Error registering webhook:', error);
    return NextResponse.json(
      { error: 'Failed to register webhook', details: error.message },
      { status: 500 }
    );
  }
}