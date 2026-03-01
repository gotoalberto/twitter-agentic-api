import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/twitter/users/[username]/tweets
 * Get user's tweets using TwitterAPI.io
 *
 * Query parameters:
 * - count: Number of tweets (default: 20, max: 100)
 * - cursor: Pagination cursor
 * - exclude_replies: Exclude replies (default: false)
 * - include_rts: Include retweets (default: true)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const username = params.username;

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required - include X-API-Key header' },
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

    // Verify API key
    if (project.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if project is enabled
    if (!project.apiEnabled) {
      return NextResponse.json(
        { error: 'API access is disabled for this project' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(parseInt(searchParams.get('count') || '20'), 100);
    const cursor = searchParams.get('cursor') || undefined;
    // Note: TwitterAPI.io might not support these filters, but we include them for future compatibility
    const excludeReplies = searchParams.get('exclude_replies') === 'true';
    const includeRts = searchParams.get('include_rts') !== 'false'; // Default true

    // Get user tweets using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.getUserTweets(username, count, cursor);

    // Convert tweets to our standard format
    // Filter based on parameters if TwitterAPI.io doesn't support them natively
    let formattedTweets = result.tweets.map(tweet =>
      TwitterApiIoClient.convertTweetToApiFormat(tweet)
    );

    // Apply filters if needed
    if (excludeReplies) {
      formattedTweets = formattedTweets.filter(tweet => !tweet.in_reply_to_user_id);
    }

    if (!includeRts) {
      formattedTweets = formattedTweets.filter(tweet =>
        !tweet.referenced_tweets?.some((ref: any) => ref.type === 'retweeted')
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tweets: formattedTweets,
        next_cursor: result.next_cursor,
        has_more: result.has_more
      },
      meta: {
        username,
        count: formattedTweets.length,
        filters: {
          exclude_replies: excludeReplies,
          include_rts: includeRts
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching user tweets:', error);

    // Check if it's a TwitterAPI.io error
    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        {
          error: 'Twitter API error',
          details: error.message
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user tweets' },
      { status: 500 }
    );
  }
}