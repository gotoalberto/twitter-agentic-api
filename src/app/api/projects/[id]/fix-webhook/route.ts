import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import { registerWebhook, subscribeWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { saveWebhookRegistration } from '@/lib/db/webhooks';

/**
 * Fix webhook registration for a project
 * This endpoint will:
 * 1. Check if a webhook exists for the project's TwitterApp
 * 2. If not, register a new webhook using the TwitterApp credentials
 * 3. Subscribe the bot to the webhook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'No TwitterApp configured for this project' }, { status: 400 });
    }

    const bot = project.bot;
    const twitterApp = project.twitterApp;
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twitter/${twitterApp.id}`;
    const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

    console.log('🔧 Fixing webhook for project:', projectId);
    console.log('   Bot:', bot.username, '(', bot.userId, ')');
    console.log('   TwitterApp:', twitterApp.name);
    console.log('   Webhook URL:', webhookUrl);

    // Use bearer token from TwitterApp
    const bearerToken = twitterApp.bearerToken;

    // List webhooks using the TwitterApp's bearer token
    let twitterWebhooks: any[] = [];
    try {
      twitterWebhooks = await listWebhooks(bearerToken, webhookEnv);
      console.log(`📋 Found ${twitterWebhooks.length} webhooks in Twitter for this app`);
    } catch (error: any) {
      console.error('Failed to list webhooks:', error);
    }

    // Check if our webhook already exists
    let webhook = twitterWebhooks.find(w => w.url === webhookUrl);
    let webhookId: string;

    if (webhook) {
      webhookId = webhook.id;
      console.log('✅ Webhook already exists in Twitter:', webhookId);
    } else {
      // Register new webhook
      console.log('📝 Registering new webhook...');
      try {
        const result = await registerWebhook(
          webhookUrl,
          twitterApp.consumerKey,
          twitterApp.consumerSecret,
          webhookEnv
        );
        webhookId = result.webhookId;
        console.log('✅ Webhook registered successfully:', webhookId);
      } catch (regError: any) {
        console.error('Failed to register webhook:', regError);
        return NextResponse.json({
          error: 'Failed to register webhook',
          details: regError.message
        }, { status: 500 });
      }
    }

    // Delete old webhook registrations if they exist
    if (project.webhookRegistrations.length > 0) {
      console.log('🗑️ Deleting old webhook registrations from database...');
      await prisma.webhookRegistration.deleteMany({
        where: { projectId }
      });
    }

    // Save new webhook registration
    await saveWebhookRegistration(projectId, {
      webhookId,
      url: webhookUrl,
      subscribed: false,
    });

    // Subscribe bot to webhook
    console.log('📡 Subscribing bot to webhook...');
    try {
      await subscribeWebhook(
        twitterApp.consumerKey,
        twitterApp.consumerSecret,
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

      console.log('✅ Bot subscribed successfully!');

      return NextResponse.json({
        success: true,
        message: 'Webhook fixed successfully',
        webhookId,
        webhookUrl,
        subscribed: true
      });

    } catch (subError: any) {
      console.error('Subscription failed:', subError);

      // Check if it's already subscribed (409 error)
      if (subError.message && subError.message.includes('409')) {
        await prisma.webhookRegistration.updateMany({
          where: {
            projectId,
            webhookId
          },
          data: { subscribed: true }
        });

        return NextResponse.json({
          success: true,
          message: 'Webhook was already subscribed',
          webhookId,
          webhookUrl,
          subscribed: true
        });
      }

      return NextResponse.json({
        success: false,
        message: 'Webhook registered but subscription failed',
        error: subError.message,
        webhookId,
        webhookUrl
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error fixing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fix webhook', details: error.message },
      { status: 500 }
    );
  }
}