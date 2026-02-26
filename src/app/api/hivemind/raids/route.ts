import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET: Fetch promoted tweets (raids) with pagination
 *
 * Query parameters:
 * - cursor: Cursor for pagination (optional)
 * - limit: Number of raids to fetch (default: 20, max: 100)
 * - status: Filter by status (optional: pending, processing, completed, failed)
 *
 * Returns:
 * - raids: Array of raid objects
 * - nextCursor: Cursor for next page
 * - hasMore: Boolean indicating if there are more results
 */
export async function GET(req: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = req.headers.get('x-api-key');

    // Check if request is from the web interface (no API key) or programmatic access (with API key)
    if (apiKey) {
      // If API key is provided, it must be valid
      if (!apiKey.startsWith('hm_')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid Hivemind API key'
          },
          { status: 401 }
        );
      }

      // Verify Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid API key'
          },
          { status: 401 }
        );
      }
    }
    // If no API key, allow access (for web interface)

    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');

    console.log('📚 Fetching raids with params:', { cursor, limit, status });

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }

    // If cursor is provided, use it for pagination
    if (cursor) {
      where.id = { lt: cursor };
    }

    // Fetch raids with pagination
    const raids = await prisma.hivemindRaid.findMany({
      where,
      orderBy: {
        submittedAt: 'desc'
      },
      take: limit + 1, // Fetch one extra to check if there's more
      select: {
        id: true,
        tweetUrl: true,
        tweetId: true,
        tweetAuthor: true,
        tweetText: true,
        submittedBy: true,
        submittedAt: true,
        status: true,
        processedAt: true,
        completedAt: true,
        likesCount: true,
        retweetsCount: true,
        failedCount: true,
        totalMembers: true,
        metadata: true
      }
    });

    // Check if there are more results
    const hasMore = raids.length > limit;
    const raidsToReturn = hasMore ? raids.slice(0, -1) : raids;
    const nextCursor = hasMore ? raidsToReturn[raidsToReturn.length - 1]?.id : null;

    // Format the response
    const formattedRaids = raidsToReturn.map(raid => ({
      ...raid,
      stats: {
        likes: raid.likesCount,
        retweets: raid.retweetsCount,
        total: raid.likesCount + raid.retweetsCount
      }
    }));

    console.log(`✅ Fetched ${formattedRaids.length} raids`);

    return NextResponse.json({
      success: true,
      raids: formattedRaids,
      nextCursor,
      hasMore,
      pagination: {
        limit,
        cursor,
        total: formattedRaids.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching raids:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch raids'
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Submit a tweet for promotion (raid)
 *
 * Body:
 * - tweetUrl: Full URL of the tweet
 * - tweetId: Tweet ID extracted from URL
 *
 * Returns:
 * - success: Boolean
 * - raid: Created raid object
 * - raidId: ID of the created raid
 */
export async function POST(req: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = req.headers.get('x-api-key');

    // Check if request is from the web interface (no API key) or programmatic access (with API key)
    if (apiKey) {
      // If API key is provided, it must be valid
      if (!apiKey.startsWith('hm_')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid Hivemind API key'
          },
          { status: 401 }
        );
      }

      // Verify Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid API key'
          },
          { status: 401 }
        );
      }
    }
    // If no API key, allow access (for web interface)

    const body = await req.json();
    const { tweetUrl, tweetId } = body;

    console.log('🎯 New raid request:', { tweetUrl, tweetId });

    // Validate input
    if (!tweetUrl || !tweetId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tweet URL and ID are required'
        },
        { status: 400 }
      );
    }

    // Check if this tweet has already been raided recently (within 24 hours)
    const existingRaid = await prisma.hivemindRaid.findFirst({
      where: {
        tweetId,
        submittedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        }
      }
    });

    if (existingRaid) {
      console.log('⚠️ Tweet already raided recently:', tweetId);
      return NextResponse.json(
        {
          success: false,
          error: 'This tweet has already been raided in the last 24 hours'
        },
        { status: 400 }
      );
    }

    // Try to fetch tweet info using TwitterAPI.io
    let tweetAuthor = null;
    let tweetText = null;
    let metadata = {};

    try {
      const twitterApiIoClient = getTwitterApiIoClient();

      // Extract username from URL
      const urlMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\//i);
      if (urlMatch && urlMatch[1]) {
        tweetAuthor = urlMatch[1];
        console.log('📝 Extracted author from URL:', tweetAuthor);
      }

      // You could fetch additional tweet details here if TwitterAPI.io supports it
      // For now, we'll just store what we have

    } catch (error) {
      console.error('⚠️ Could not fetch tweet details:', error);
      // Continue anyway, we can still raid the tweet
    }

    // Get submitter info
    const submittedBy = req.headers.get('x-forwarded-for') ||
                       req.headers.get('x-real-ip') ||
                       'anonymous';

    // Get current number of connected Hivemind members
    const connectedMembers = await prisma.hivemindUser.count({
      where: {
        isActive: true
      }
    });

    console.log(`📊 ${connectedMembers} active Hivemind members available for raid`);

    // Create the raid entry
    const raid = await prisma.hivemindRaid.create({
      data: {
        tweetUrl,
        tweetId,
        tweetAuthor,
        tweetText,
        submittedBy,
        status: 'pending',
        totalMembers: connectedMembers,
        metadata: metadata as any
      }
    });

    console.log('✅ Raid created:', raid.id);

    // Trigger raid execution asynchronously
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hive.pepes.dog';

    // Execute raid in the background (don't await)
    fetch(`${baseUrl}/api/hivemind/raids/${raid.id}/execute`, {
      method: 'POST',
    }).catch(error => {
      console.error('❌ Failed to trigger raid execution:', error);
    });

    // Format response
    const formattedRaid = {
      ...raid,
      stats: {
        likes: 0,
        retweets: 0,
        total: 0
      }
    };

    return NextResponse.json({
      success: true,
      raid: formattedRaid,
      raidId: raid.id,
      message: `Tweet submitted for raid. ${connectedMembers} members will engage with it.`
    });

  } catch (error) {
    console.error('❌ Error creating raid:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit tweet for raid'
      },
      { status: 500 }
    );
  }
}