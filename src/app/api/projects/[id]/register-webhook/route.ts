import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { listWebhooks, registerWebhook, subscribeWebhook } from '@/lib/twitter/webhooks';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import { saveWebhookRegistration } from '@/lib/db/webhooks';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
)
 {
  try {
    const { id: projectId } = await params;

    // Get project with bot
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

    const bot = project.bot;
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twitter`;
    const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

    // Check if webhook already registered
    if (project.webhookRegistrations.length > 0) {
      const existing = project.webhookRegistrations[0];

      // Try to subscribe if not already subscribed
      if (!existing.subscribed && bot.accessToken && bot.accessTokenSecret) {
        try {
          // Use env var credentials for subscription (shared webhook)
          const apiKey = process.env.TWITTER_OAUTH_API_KEY;
          const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

          if (!apiKey || !apiSecret) {
            throw new Error('Environment credentials not configured');
          }

          const bearerToken = process.env.X_API_BEARER_TOKEN!;
          await subscribeWebhook(
            apiKey,
            apiSecret,
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

    // Register new webhook using shared webhook approach
    const envBearerToken = process.env.X_API_BEARER_TOKEN;
    if (!envBearerToken) {
      return NextResponse.json({ error: 'Bearer token not configured' }, { status: 500 });
    }

    // Check if shared webhook exists
    const twitterWebhooks = await listWebhooks(envBearerToken, webhookEnv);
    const sharedWebhook = twitterWebhooks.find(w => w.url === webhookUrl);

    let webhookId: string;

    if (sharedWebhook) {
      // Use existing shared webhook
      webhookId = sharedWebhook.id;
      console.log('Using existing shared webhook:', webhookId);
    } else {
      // Register new webhook
      const apiKey = process.env.TWITTER_OAUTH_API_KEY;
      const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

      if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: 'OAuth credentials not configured' }, { status: 500 });
      }

      try {
        const result = await registerWebhook(webhookUrl, apiKey, apiSecret, webhookEnv);
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
        const apiKey = process.env.TWITTER_OAUTH_API_KEY;
        const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

        if (!apiKey || !apiSecret) {
          throw new Error('OAuth credentials not configured');
        }

        await subscribeWebhook(
          apiKey,
          apiSecret,
          bot.accessToken,
          bot.accessTokenSecret,
          webhookId,
          bot.userId,
          envBearerToken,
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