import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

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

    // Get project with bot and webhook registrations
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bot: true,
        webhookRegistrations: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const bot = project.bot;

    if (!bot) {
      return NextResponse.json({
        connected: false,
        bot: null,
      });
    }

    // Check webhook status
    const webhookReg = project.webhookRegistrations[0];
    const webhookStatus = webhookReg ? {
      registered: true,
      webhookId: webhookReg.webhookId,
      url: webhookReg.url,
      subscribed: webhookReg.subscribed
    } : {
      registered: false
    };

    return NextResponse.json({
      connected: true,
      bot: {
        userId: bot.userId,
        username: bot.username,
        connectedAt: bot.createdAt,
      },
      webhookStatus
    });
  } catch (error: any) {
    console.error('Error getting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to get bot status' },
      { status: 500 }
    );
  }
}
