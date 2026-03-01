import { NextRequest, NextResponse } from 'next/server';
import { validateHivemindApiKey } from '@/lib/auth/hivemind';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';
import { TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/hivemind/twitter/users/[username]
 * Get user profile information using TwitterAPI.io
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

    if (error.message?.includes('TwitterAPI.io')) {
      return NextResponse.json(
        { error: 'Twitter API error', details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user information' },
      { status: 500 }
    );
  }
}