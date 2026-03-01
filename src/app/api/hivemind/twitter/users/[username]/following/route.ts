import { NextRequest, NextResponse } from 'next/server';
import { validateHivemindApiKey } from '@/lib/auth/hivemind';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/users/[username]/following
 * Get users that a user is following using TwitterAPI.io
 *
 * Query parameters:
 * - cursor: Pagination cursor
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
    const cursor = searchParams.get('cursor') || undefined;

    // Get user following using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.getUserFollowing(username, cursor);

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
        username,
        count: formattedUsers.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching following:', error);

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch following list' },
      { status: 500 }
    );
  }
}