import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { getHivemindConfig, createOrUpdateHivemindConfig } from '@/lib/db/hivemind';

export async function GET(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.user.username || !isAdmin(session.user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await getHivemindConfig();

    return NextResponse.json(config || { enabled: false, twitterAppId: null });

  } catch (error) {
    console.error('Error getting Hivemind config:', error);
    return NextResponse.json(
      { error: 'Failed to get Hivemind configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.user.username || !isAdmin(session.user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { twitterAppId, enabled } = body;

    const config = await createOrUpdateHivemindConfig(twitterAppId, enabled);

    console.log('✅ Hivemind configuration updated:', {
      enabled,
      twitterAppId: twitterAppId || 'env-var'
    });

    return NextResponse.json(config);

  } catch (error) {
    console.error('Error updating Hivemind config:', error);
    return NextResponse.json(
      { error: 'Failed to update Hivemind configuration' },
      { status: 500 }
    );
  }
}