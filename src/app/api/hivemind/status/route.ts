import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getHivemindUserById } from '@/lib/db/hivemind';

export async function GET(request: NextRequest) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is connected to Hivemind
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({
        isConnected: false,
        message: 'User ID not found'
      });
    }

    const hivemindUser = await getHivemindUserById(userId);

    if (!hivemindUser) {
      return NextResponse.json({
        isConnected: false,
        message: 'Not connected to Hivemind'
      });
    }

    // Return connection status (don't include sensitive tokens)
    return NextResponse.json({
      isConnected: true,
      userId: hivemindUser.userId,
      username: hivemindUser.username,
      displayName: hivemindUser.displayName,
      profileImageUrl: hivemindUser.profileImageUrl,
      connectedAt: hivemindUser.connectedAt,
      lastActiveAt: hivemindUser.lastActiveAt,
      isActive: hivemindUser.isActive
    });

  } catch (error) {
    console.error('Error checking Hivemind status:', error);
    return NextResponse.json(
      { error: 'Failed to check Hivemind status' },
      { status: 500 }
    );
  }
}