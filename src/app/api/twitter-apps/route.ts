import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getAllTwitterApps, createTwitterApp } from '@/lib/db/twitter-apps';

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
    const { name, consumerKey, consumerSecret, clientId, clientSecret, bearerToken, webhookEnv } = body;

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

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        webhookEnv: app.webhookEnv,
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
