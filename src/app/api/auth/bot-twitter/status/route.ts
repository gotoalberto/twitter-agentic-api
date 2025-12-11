import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getConnectedBot } from '@/lib/twitter/bot';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bot = await getConnectedBot();

    if (!bot) {
      return NextResponse.json({
        connected: false,
        bot: null,
      });
    }

    // Don't return encrypted tokens to client
    return NextResponse.json({
      connected: true,
      bot: {
        userId: bot.userId,
        username: bot.username,
        connectedAt: bot.connectedAt,
      },
    });
  } catch (error: any) {
    console.error('Error getting bot status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
