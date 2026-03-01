import { NextRequest, NextResponse } from 'next/server';
import { validateHivemindApiKey } from '@/lib/auth/hivemind';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/users/search
 * Search users by keyword using TwitterAPI.io
 *
 * Query parameters:
 * - q: Search query (required)
 * - count: Number of results (default: 20, max: 100)
 * - cursor: Pagination cursor
 */
export async function GET(request: NextRequest) {
  try {
    // Validate Hivemind API key
    const auth = await validateHivemindApiKey(request);
    if (!auth.valid) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
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

    // Search users using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.searchUsers(query, {
      count,
      cursor
    });

    // Convert users to our standard format
    const formattedUsers = result.users.map(user =>
      TwitterApiIoClient.convertUserToApiFormat(user)
    );

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        next_cursor: result.next_cursor,
        has_more: result.has_more
      },
      meta: {
        query,
        count: formattedUsers.length
      }
    });

  } catch (error: any) {
    console.error('Error searching users:', error);

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}