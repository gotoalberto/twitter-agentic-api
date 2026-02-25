import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: Get public Hivemind activity feed (no auth required)
 * Supports pagination with cursor-based scrolling
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const actionType = searchParams.get('type'); // 'like', 'retweet', or null for all

    // Build the where clause
    const where: any = {};
    if (actionType && ['like', 'retweet'].includes(actionType)) {
      where.actionType = actionType;
    }
    if (cursor) {
      where.id = { lt: cursor };
    }

    // Fetch actions
    const actions = await prisma.hivemindAction.findMany({
      where,
      orderBy: {
        performedAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        userId: true,
        username: true,
        displayName: true,
        actionType: true,
        tweetId: true,
        tweetAuthor: true,
        tweetText: true,
        tweetUrl: true,
        performedAt: true,
        hivemindUser: {
          select: {
            profileImageUrl: true,
          },
        },
      },
    });

    // Get the next cursor
    const nextCursor = actions.length === limit ? actions[actions.length - 1].id : null;

    // Transform the data
    const transformedActions = actions.map(action => ({
      id: action.id,
      user: {
        id: action.userId,
        username: action.username,
        displayName: action.displayName,
        profileImageUrl: action.hivemindUser.profileImageUrl,
      },
      type: action.actionType,
      tweet: {
        id: action.tweetId,
        author: action.tweetAuthor,
        text: action.tweetText,
        url: action.tweetUrl,
      },
      performedAt: action.performedAt.toISOString(),
    }));

    return NextResponse.json({
      actions: transformedActions,
      nextCursor,
      hasMore: nextCursor !== null,
    });
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed' },
      { status: 500 }
    );
  }
}