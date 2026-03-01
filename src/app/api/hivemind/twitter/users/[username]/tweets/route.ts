import { NextRequest, NextResponse } from 'next/server';
import { validateHivemindApiKey } from '@/lib/auth/hivemind';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/users/[username]/tweets
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
  context: { params: Promise<{ username: string }> }
) {
  try {
    // Validate Hivemind API key
    const auth = await validateHivemindApiKey(request);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const username = params.username;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(parseInt(searchParams.get('count') || '20'), 100);
    const cursor = searchParams.get('cursor') || undefined;
    const excludeReplies = searchParams.get('exclude_replies') === 'true';
    const includeRts = searchParams.get('include_rts') !== 'false';

    // Get user tweets using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.getUserTweets(username, count, cursor);

    // Convert tweets to our standard format
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
        filters: { exclude_replies: excludeReplies, include_rts: includeRts }
      }
    });

  } catch (error: any) {
    console.error('Error fetching user tweets:', error);

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user tweets' },
      { status: 500 }
    );
  }
}