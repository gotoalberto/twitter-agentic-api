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

    // Check OAuth statuses
    const oauth1Status = {
      connected: !!(bot.accessToken && bot.accessTokenSecret),
      hasAccessToken: !!bot.accessToken,
      hasAccessTokenSecret: !!bot.accessTokenSecret,
      capabilities: bot.accessToken && bot.accessTokenSecret ? [
        'tweet_with_media',
        'direct_messages',
        'webhooks',
        'all_v1_endpoints'
      ] : []
    };

    const oauth2Status = {
      connected: !!bot.oauth2AccessToken,
      hasAccessToken: !!bot.oauth2AccessToken,
      hasRefreshToken: !!bot.refreshToken,
      expiresAt: bot.expiresAt,
      isExpired: bot.expiresAt ? new Date() > new Date(bot.expiresAt) : false,
      scopes: bot.scope?.split(' ') || [],
      capabilities: bot.oauth2AccessToken ? [
        'tweet_text_only',
        'user_profile',
        'modern_api'
      ] : []
    };

    return NextResponse.json({
      connected: true,
      bot: {
        userId: bot.userId,
        username: bot.username,
        connectedAt: bot.createdAt,
      },
      oauth: {
        oauth1: oauth1Status,
        oauth2: oauth2Status,
        hasFullCapabilities: oauth1Status.connected && oauth2Status.connected,
        recommendedAction: !oauth1Status.connected ? 'connect_oauth1_for_media' :
                           !oauth2Status.connected ? 'connect_oauth2_for_modern_api' :
                           null
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
