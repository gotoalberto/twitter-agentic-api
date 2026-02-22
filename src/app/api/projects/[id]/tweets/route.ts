/**
 * API Endpoint: Get received tweets for a project
 *
 * GET /api/projects/{projectId}/tweets
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Number of tweets per page (default: 20, max: 100)
 * - userId: Filter by sender user ID
 * - forUserId: Filter by bot user ID that received the tweet
 * - since: ISO date string to get tweets after this date
 * - until: ISO date string to get tweets before this date
 *
 * Headers:
 * - X-API-Key: Project's API key
 *
 * Response:
 * - tweets: Array of tweet objects
 * - pagination: Pagination metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getProjectById } from '@/lib/db/projects';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify API key
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please provide X-API-Key header.' },
        { status: 401 }
      );
    }

    // Get and validate project
    const project = await getProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if API is enabled for this project
    if (!project.apiEnabled) {
      return NextResponse.json(
        { error: 'API is disabled for this project' },
        { status: 403 }
      );
    }

    // Verify API key
    if (project.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const userId = searchParams.get('userId');
    const forUserId = searchParams.get('forUserId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    // Validate page and limit
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be greater than 0' },
        { status: 400 }
      );
    }

    if (limit < 1) {
      return NextResponse.json(
        { error: 'Limit must be greater than 0' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      projectId
    };

    if (userId) {
      where.userId = userId;
    }

    if (forUserId) {
      where.forUserId = forUserId;
    }

    if (since || until) {
      where.receivedAt = {};
      if (since) {
        where.receivedAt.gte = new Date(since);
      }
      if (until) {
        where.receivedAt.lte = new Date(until);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.receivedTweet.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Get tweets
    const tweets = await prisma.receivedTweet.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        tweetId: true,
        userId: true,
        username: true,
        userDisplayName: true,
        text: true,
        truncated: true,
        inReplyToStatusId: true,
        inReplyToUserId: true,
        forUserId: true,
        lang: true,
        retweetCount: true,
        favoriteCount: true,
        replyCount: true,
        quoteCount: true,
        entities: true,
        extendedEntities: true,
        tweetCreatedAt: true,
        receivedAt: true
      }
    });

    // Format response
    return NextResponse.json({
      tweets,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage
      }
    });

  } catch (error: any) {
    console.error('Error fetching tweets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET a specific tweet by ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify API key
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please provide X-API-Key header.' },
        { status: 401 }
      );
    }

    // Get and validate project
    const project = await getProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if API is enabled for this project
    if (!project.apiEnabled) {
      return NextResponse.json(
        { error: 'API is disabled for this project' },
        { status: 403 }
      );
    }

    // Verify API key
    if (project.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tweetId } = body;

    if (!tweetId) {
      return NextResponse.json(
        { error: 'tweetId is required in request body' },
        { status: 400 }
      );
    }

    // Get the tweet with full payload
    const tweet = await prisma.receivedTweet.findFirst({
      where: {
        projectId,
        tweetId
      }
    });

    if (!tweet) {
      return NextResponse.json(
        { error: 'Tweet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ tweet });

  } catch (error: any) {
    console.error('Error fetching tweet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}