import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/twitter/users/[username]/followers
 * Get user's followers using TwitterAPI.io
 *
 * Query parameters:
 * - count: Number of followers per page (default: 200)
 * - cursor: Pagination cursor
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
    const cursor = searchParams.get('cursor') || undefined;

    // Get user followers using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const result = await client.getUserFollowers(username, cursor);

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
    console.error('Error fetching followers:', error);

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
      { error: 'Failed to fetch followers' },
      { status: 500 }
    );
  }
}