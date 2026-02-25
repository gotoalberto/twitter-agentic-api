import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { getActiveHivemindUsers } from '@/lib/db/hivemind';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check for API key first
    const apiKey = request.headers.get('x-api-key');
    let isAuthorized = false;

    if (apiKey && apiKey.startsWith('hm_')) {
      // Check Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (hivemindConfig && hivemindConfig.apiKey === apiKey) {
        isAuthorized = true;
      }
    }

    // If no valid API key, check session
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);

      if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized - API key or session required' }, { status: 401 });
      }

      // Check if user is admin
      if (!session.user.username || !isAdmin(session.user.username)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      isAuthorized = true;
    }

    const users = await getActiveHivemindUsers();

    return NextResponse.json(users);

  } catch (error) {
    console.error('Error getting Hivemind users:', error);
    return NextResponse.json(
      { error: 'Failed to get Hivemind users' },
      { status: 500 }
    );
  }
}