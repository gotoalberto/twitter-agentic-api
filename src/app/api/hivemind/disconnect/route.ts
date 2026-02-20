import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { disconnectHivemindUser, getHivemindUserById } from '@/lib/db/hivemind';

export async function POST(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is connected to Hivemind
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found' },
        { status: 400 }
      );
    }

    const hivemindUser = await getHivemindUserById(userId);

    if (!hivemindUser) {
      return NextResponse.json(
        { error: 'Not connected to Hivemind' },
        { status: 400 }
      );
    }

    // Disconnect user (mark as inactive)
    await disconnectHivemindUser(userId);

    console.log('✅ Hivemind user disconnected:', hivemindUser.username);

    return NextResponse.json({
      success: true,
      message: 'Successfully disconnected from Hivemind'
    });

  } catch (error) {
    console.error('Error disconnecting from Hivemind:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from Hivemind' },
      { status: 500 }
    );
  }
}