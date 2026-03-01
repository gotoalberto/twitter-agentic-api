import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/search
 * Search tweets using TwitterAPI.io for Hivemind
 *
 * Query parameters:
 * - q: Search query (required)
 * - count: Number of results (default: 20, max: 100)
 * - cursor: Pagination cursor
 * - from: Filter tweets from specific user
 * - to: Filter tweets to specific user
 * - lang: Language filter
 * - filter: Additional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    // Check if request is from web interface (no API key) or programmatic access (with API key)
    if (apiKey) {
      // If API key is provided, it must be valid
      if (!apiKey.startsWith('hm_')) {
        return NextResponse.json(
          { error: 'Invalid Hivemind API key' },
          { status: 401 }
        );
      }

      // Verify Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
    }

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    const count = Math.min(parseInt(searchParams.get('count') || '20'), 100);
    const cursor = searchParams.get('cursor') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const lang = searchParams.get('lang') || undefined;
    const filter = searchParams.get('filter') || undefined;

    // Search tweets using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.searchTweets(query, {
      count,
      cursor,
      from,
      to,
      lang,
      filter
    });

    // Convert tweets to our standard format
    const formattedTweets = result.tweets.map(tweet =>
      TwitterApiIoClient.convertTweetToApiFormat(tweet)
    );

    return NextResponse.json({
      success: true,
      data: {
        tweets: formattedTweets,
        next_cursor: result.next_cursor,
        has_more: result.has_more
      },
      meta: {
        query,
        count: formattedTweets.length,
        filters: { from, to, lang, filter }
      }
    });

  } catch (error: any) {
    console.error('Error searching tweets:', error);

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to search tweets' },
      { status: 500 }
    );
  }
}