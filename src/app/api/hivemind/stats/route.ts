import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { getHivemindStats } from '@/lib/db/hivemind';

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

    const stats = await getHivemindStats();

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error getting Hivemind stats:', error);
    return NextResponse.json(
      { error: 'Failed to get Hivemind statistics' },
      { status: 500 }
    );
  }
}