import { NextRequest, NextResponse } from 'next/server';
import { validateHivemindApiKey } from '@/lib/auth/hivemind';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/tweets/[tweetId]
 * Get tweet information by ID using TwitterAPI.io
 *
 * Query parameters:
 * - include_replies: Include reply tweets (default: false)
 * - include_quotes: Include quote tweets (default: false)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tweetId: string }> }
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
    const tweetId = params.tweetId;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeReplies = searchParams.get('include_replies') === 'true';
    const includeQuotes = searchParams.get('include_quotes') === 'true';

    // Get tweet information using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const tweet = await client.getTweetById(tweetId);

    // Convert to our standard format
    const formattedTweet = TwitterApiIoClient.convertTweetToApiFormat(tweet);

    // Prepare response
    const response: any = {
      success: true,
      data: {
        tweet: formattedTweet
      }
    };

    // Optionally include replies
    if (includeReplies) {
      try {
        const replies = await client.getTweetReplies(tweetId);
        response.data.replies = {
          tweets: replies.tweets.map(t => TwitterApiIoClient.convertTweetToApiFormat(t)),
          next_cursor: replies.next_cursor,
          has_more: replies.has_more
        };
      } catch (error) {
        console.error('Error fetching replies:', error);
        response.data.replies = { error: 'Failed to fetch replies' };
      }
    }

    // Optionally include quotes
    if (includeQuotes) {
      try {
        const quotes = await client.getTweetQuotes(tweetId);
        response.data.quotes = {
          tweets: quotes.tweets.map(t => TwitterApiIoClient.convertTweetToApiFormat(t)),
          next_cursor: quotes.next_cursor,
          has_more: quotes.has_more
        };
      } catch (error) {
        console.error('Error fetching quotes:', error);
        response.data.quotes = { error: 'Failed to fetch quotes' };
      }
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching tweet:', error);

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch tweet information' },
      { status: 500 }
    );
  }
}