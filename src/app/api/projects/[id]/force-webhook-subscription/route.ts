import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { listWebhooks, subscribeWebhook } from '@/lib/twitter/webhooks';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

/**
 * Force webhook subscription using env-var credentials
 * This endpoint is designed to fix webhook subscription issues when there's a token mismatch
 * between the bot's OAuth tokens (created with TwitterApp) and the shared webhook (env-var app)
 */
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

    if (project.webhookRegistrations.length === 0) {
      return NextResponse.json({
        error: 'No webhook registered. Please register webhook first.'
      }, { status: 400 });
    }

    const bot = project.bot;
    const webhookReg = project.webhookRegistrations[0];
    const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

    // Get env-var credentials (the webhook owner)
    const envApiKey = process.env.TWITTER_OAUTH_API_KEY;
    const envApiSecret = process.env.TWITTER_OAUTH_API_SECRET;
    const envBearerToken = process.env.X_API_BEARER_TOKEN;

    if (!envApiKey || !envApiSecret || !envBearerToken) {
      return NextResponse.json({
        error: 'Environment OAuth credentials not configured'
      }, { status: 500 });
    }

    console.log('🔧 Force webhook subscription for project:', projectId);
    console.log('   Bot:', bot.username, '(', bot.userId, ')');
    console.log('   Webhook:', webhookReg.webhookId);
    console.log('   Current status:', webhookReg.subscribed ? 'subscribed' : 'not subscribed');

    // Check if this is the shared env-var webhook
    const isSharedWebhook = webhookReg.webhookId === '1999190094972911617';

    if (!isSharedWebhook) {
      console.log('⚠️  Not a shared webhook, using regular subscription...');

      // For non-shared webhooks, use regular subscription
      try {
        await subscribeWebhook(
          envApiKey,
          envApiSecret,
          bot.accessToken,
          bot.accessTokenSecret,
          webhookReg.webhookId,
          bot.userId,
          envBearerToken,
          webhookEnv
        );
      } catch (error: any) {
        console.error('Regular subscription failed:', error);
        return NextResponse.json({
          success: false,
          message: 'Failed to subscribe to webhook',
          error: error.message
        }, { status: 500 });
      }
    } else {
      console.log('✅ Shared webhook detected, using special subscription flow...');

      // For shared webhook, we need to create new OAuth tokens using env-var credentials
      // This ensures token compatibility with the webhook

      try {
        // Step 1: Create OAuth 1.0a instance with env-var credentials
        const oauth = new OAuth({
          consumer: {
            key: envApiKey,
            secret: envApiSecret
          },
          signature_method: 'HMAC-SHA1',
          hash_function(base_string, key) {
            return crypto
              .createHmac('sha1', key)
              .update(base_string)
              .digest('base64');
          }
        });

        // Step 2: Try to subscribe using a different approach
        // We'll use the bearer token to subscribe on behalf of the user
        const subscribeUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/subscriptions.json`;

        // Create OAuth signature for subscription
        const subscribeData = {
          url: subscribeUrl,
          method: 'POST'
        };

        // Use the bot's existing tokens but with env-var consumer credentials
        // This creates a hybrid approach that might work
        const token = {
          key: bot.accessToken,
          secret: bot.accessTokenSecret
        };

        const headers = oauth.toHeader(oauth.authorize(subscribeData, token));

        console.log('📡 Attempting subscription with hybrid approach...');

        const response = await fetch(subscribeUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        const responseText = await response.text();

        if (response.status === 204 || response.status === 200) {
          console.log('✅ Subscription successful!');
        } else if (response.status === 409) {
          console.log('⚠️  Already subscribed (409)');
        } else {
          console.error('❌ Subscription failed:', response.status, responseText);

          // If hybrid approach fails, try bearer token approach
          console.log('🔄 Trying bearer token approach...');

          const bearerResponse = await fetch(
            `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/subscriptions.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${envBearerToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: `user_id=${bot.userId}`
            }
          );

          const bearerResponseText = await bearerResponse.text();

          if (bearerResponse.status === 204 || bearerResponse.status === 200) {
            console.log('✅ Bearer token subscription successful!');
          } else if (bearerResponse.status === 409) {
            console.log('⚠️  Already subscribed via bearer token (409)');
          } else {
            console.error('❌ Bearer token subscription failed:', bearerResponse.status, bearerResponseText);
            throw new Error(`All subscription methods failed. Last error: ${bearerResponseText}`);
          }
        }

        // Update subscription status in database
        await prisma.webhookRegistration.update({
          where: { id: webhookReg.id },
          data: { subscribed: true }
        });

        console.log('✅ Database updated - webhook marked as subscribed');

      } catch (error: any) {
        console.error('Force subscription failed:', error);

        // As a last resort, mark as subscribed if we got a 409 (already subscribed) error
        if (error.message && error.message.includes('409')) {
          await prisma.webhookRegistration.update({
            where: { id: webhookReg.id },
            data: { subscribed: true }
          });

          return NextResponse.json({
            success: true,
            message: 'Webhook was already subscribed. Database updated.',
            webhookId: webhookReg.webhookId
          });
        }

        return NextResponse.json({
          success: false,
          message: 'Failed to force webhook subscription',
          error: error.message,
          details: 'This usually happens when there is a token mismatch. Consider reconnecting the bot.'
        }, { status: 500 });
      }
    }

    // Final success response
    return NextResponse.json({
      success: true,
      message: 'Webhook subscription forced successfully',
      webhookId: webhookReg.webhookId,
      subscribed: true
    });

  } catch (error: any) {
    console.error('Error in force webhook subscription:', error);
    return NextResponse.json(
      { error: 'Failed to force webhook subscription', details: error.message },
      { status: 500 }
    );
  }
}