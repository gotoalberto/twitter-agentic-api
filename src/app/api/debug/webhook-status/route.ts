import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { listWebhooks } from '@/lib/twitter/webhooks';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Get project with all related data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        twitterApp: true,
        bot: true,
        webhookRegistrations: true,
        forwardingEndpoints: true,
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check Twitter API for webhooks
    let twitterWebhooks: any[] = [];
    let webhookError: string | null = null;

    try {
      // Try with env var bearer token first (as per callback logic)
      const envBearerToken = process.env.X_API_BEARER_TOKEN;
      const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';

      if (envBearerToken) {
        twitterWebhooks = await listWebhooks(envBearerToken, webhookEnv);
      }
    } catch (error: any) {
      webhookError = error.message;
    }

    // Check if project should have a webhook
    const hasConnectedBot = !!project.bot;
    const hasWebhookRegistration = project.webhookRegistrations.length > 0;
    const expectedWebhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twitter`;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        usesDifferentTwitterApp: !!project.twitterAppId,
        twitterAppId: project.twitterAppId,
        twitterAppName: project.twitterApp?.name,
      },
      bot: project.bot ? {
        id: project.bot.id,
        username: project.bot.username,
        userId: project.bot.userId,
        connectedAt: project.bot.createdAt,
      } : null,
      webhookRegistrations: project.webhookRegistrations.map(wr => ({
        id: wr.id,
        webhookId: wr.webhookId,
        url: wr.url,
        subscribed: wr.subscribed,
        createdAt: wr.createdAt,
        updatedAt: wr.updatedAt,
      })),
      forwardingEndpoints: project.forwardingEndpoints.map(fc => ({
        id: fc.id,
        name: fc.name,
        endpointUrl: fc.url,
        enabled: fc.enabled,
      })),
      twitterWebhooks: {
        webhooks: twitterWebhooks.map(w => ({
          id: w.id,
          url: w.url,
          valid: w.valid,
          created_at: w.created_at,
        })),
        error: webhookError,
      },
      analysis: {
        hasConnectedBot,
        hasWebhookRegistration,
        expectedWebhookUrl,
        webhookMatch: twitterWebhooks.find(w => w.url === expectedWebhookUrl),
        issue: !hasWebhookRegistration && hasConnectedBot ?
          'Bot connected but no webhook registered in database' :
          hasWebhookRegistration && !twitterWebhooks.find(w => w.url === expectedWebhookUrl) ?
          'Webhook registered in database but not found in Twitter API' :
          null
      }
    });

  } catch (error) {
    console.error('Error checking webhook status:', error);
    return NextResponse.json(
      { error: 'Failed to check webhook status' },
      { status: 500 }
    );
  }
}