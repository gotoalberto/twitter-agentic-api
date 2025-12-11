import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId } from '@/lib/db/bots';

/**
 * GET: Get bot status for a specific project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get bot for this project
    const bot = await getBotByProjectId(projectId);

    if (!bot) {
      return NextResponse.json({
        connected: false,
        bot: null,
      });
    }

    return NextResponse.json({
      connected: true,
      bot: {
        userId: bot.userId,
        username: bot.username,
        connectedAt: bot.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error getting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to get bot status' },
      { status: 500 }
    );
  }
}
