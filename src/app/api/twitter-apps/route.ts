import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getAllTwitterApps, createTwitterApp } from '@/lib/db/twitter-apps';
import { registerWebhookForApp } from '@/lib/twitter/webhook-management';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: List all Twitter Apps (credentials masked)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apps = await getAllTwitterApps();

    // Mask credentials before sending to client
    const masked = apps.map(app => ({
      id: app.id,
      name: app.name,
      webhookEnv: app.webhookEnv,
      webhookId: app.webhookId,
      webhookUrl: app.webhookUrl,
      webhookValid: app.webhookValid,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      projectCount: (app as any)._count?.projects ?? 0,
    }));

    return NextResponse.json({ apps: masked });
  } catch (error: any) {
    console.error('Error getting Twitter Apps:', error);
    return NextResponse.json({ error: 'Failed to get Twitter Apps' }, { status: 500 });
  }
}

/**
 * POST: Create a new Twitter App
 * Supports both OAuth 1.0a and OAuth 2.0 credentials
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, consumerKey, consumerSecret, clientId, clientSecret, bearerToken, webhookEnv, registerWebhook = true } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!bearerToken?.trim()) {
      return NextResponse.json({ error: 'bearerToken is required' }, { status: 400 });
    }

    // Validate that at least one OAuth method is provided
    const hasOAuth1 = consumerKey?.trim() && consumerSecret?.trim();
    const hasOAuth2 = clientId?.trim() && clientSecret?.trim();

    if (!hasOAuth1 && !hasOAuth2) {
      return NextResponse.json({
        error: 'You must provide either OAuth 1.0a credentials (Consumer Key/Secret) or OAuth 2.0 credentials (Client ID/Secret)'
      }, { status: 400 });
    }

    const app = await createTwitterApp({
      name: name.trim(),
      consumerKey: consumerKey?.trim() || undefined,
      consumerSecret: consumerSecret?.trim() || undefined,
      clientId: clientId?.trim() || undefined,
      clientSecret: clientSecret?.trim() || undefined,
      bearerToken: bearerToken.trim(),
      webhookEnv: webhookEnv?.trim() || 'production',
    });

    // Register webhook for the new app if requested
    let webhookResult: { success: boolean; webhookId?: string; error?: string } = { success: false };

    if (registerWebhook) {
      console.log('🔄 Registering webhook for new TwitterApp:', app.name);
      webhookResult = await registerWebhookForApp(app.id);

      if (webhookResult.success) {
        console.log('✅ Webhook registered successfully for app:', app.name);
      } else {
        console.warn('⚠️ Webhook registration failed:', webhookResult.error);
        // Continue anyway - webhook can be registered later
      }
    } else {
      console.log('ℹ️ Webhook registration skipped for app:', app.name, '(user choice)');
    }

    // Get updated app with webhook info
    const updatedApp = await prisma.twitterApp.findUnique({
      where: { id: app.id },
      select: {
        webhookId: true,
        webhookUrl: true,
        webhookValid: true
      }
    });

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        webhookEnv: app.webhookEnv,
        webhookId: updatedApp?.webhookId || null,
        webhookUrl: updatedApp?.webhookUrl || null,
        webhookValid: updatedApp?.webhookValid || false,
        webhookRegistered: webhookResult.success,
        webhookSkipped: !registerWebhook,
        webhookError: registerWebhook && !webhookResult.success ? (webhookResult.error || null) : null,
        createdAt: app.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating Twitter App:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A Twitter App with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create Twitter App' }, { status: 500 });
  }
}
