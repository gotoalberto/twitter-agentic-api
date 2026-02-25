import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: Get public Hivemind stats (no auth required)
 * Returns connected users with their like/RT counts
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active Hivemind users with their stats
    const users = await prisma.hivemindUser.findMany({
      where: {
        isActive: true,
      },
      select: {
        userId: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        connectedAt: true,
        lastActiveAt: true,
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
    });

    // For each user, get their like/RT counts from rate limits
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get the latest rate limit entries for this user to estimate activity
        const rateLimits = await prisma.rateLimit.findMany({
          where: {
            hivemindUserId: user.userId,
            endpointType: {
              in: ['likes', 'retweets'],
            },
          },
          orderBy: {
            lastUpdated: 'desc',
          },
          take: 2,
        });

        // Calculate approximate likes and RTs based on rate limit usage
        let likesGiven = 0;
        let retweetsGiven = 0;

        rateLimits.forEach(limit => {
          const used = limit.limit - limit.remaining;
          if (limit.endpointType === 'likes') {
            likesGiven = used;
          } else if (limit.endpointType === 'retweets') {
            retweetsGiven = used;
          }
        });

        return {
          ...user,
          stats: {
            likes: likesGiven,
            retweets: retweetsGiven,
            total: likesGiven + retweetsGiven,
          },
        };
      })
    );

    // Sort by total activity
    usersWithStats.sort((a, b) => b.stats.total - a.stats.total);

    // Get total counts
    const totalUsers = users.length;
    const totalLikes = usersWithStats.reduce((sum, user) => sum + user.stats.likes, 0);
    const totalRetweets = usersWithStats.reduce((sum, user) => sum + user.stats.retweets, 0);

    return NextResponse.json({
      summary: {
        totalUsers,
        totalLikes,
        totalRetweets,
        totalActions: totalLikes + totalRetweets,
      },
      users: usersWithStats,
    });
  } catch (error: any) {
    console.error('Error fetching Hivemind public stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}