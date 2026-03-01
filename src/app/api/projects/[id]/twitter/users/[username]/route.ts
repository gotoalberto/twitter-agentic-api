import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/twitter/users/[username]
 * Get user profile information using TwitterAPI.io
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

    // Get user information using TwitterAPI.io
    const client = getTwitterApiIoClient();
    const user = await client.getUserByUsername(username);

    // Convert to our standard format
    const formattedUser = TwitterApiIoClient.convertUserToApiFormat(user);

    return NextResponse.json({
      success: true,
      data: formattedUser
    });

  } catch (error: any) {
    console.error('Error fetching user:', error);

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
      { error: 'Failed to fetch user information' },
      { status: 500 }
    );
  }
}