/**
 * Hivemind Rate Limits Query Endpoint
 *
 * GET: Retrieve current rate limit status for all Hivemind users
 * or for a specific user if username is provided
 *
 * Returns rate limit information for all Twitter API endpoints
 * used by Hivemind users
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHivemindConfig } from '@/lib/db/hivemind';
import {
  getAllHivemindRateLimits,
  getHivemindUserRateLimits
} from '@/lib/services/rate-limit-tracker';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET: Query rate limits for Hivemind
 *
 * Query params:
 * - username: Optional. If provided, returns rate limits for that specific user
 *
 * Response:
 * {
 *   "rateLimits": [
 *     {
 *       "account": {
 *         "id": "twitter-user-id",
 *         "username": "user_handle",
 *         "displayName": "User Display Name"
 *       },
 *       "endpoint": "POST /2/tweets",
 *       "endpointType": "tweet",
 *       "limit": 300,
 *       "remaining": 250,
 *       "used": 50,
 *       "percentageUsed": 17,
 *       "reset": "2024-02-23T10:00:00.000Z",
 *       "resetIn": 3600,
 *       "lastRequestAt": "2024-02-23T09:00:00.000Z"
 *     }
 *   ],
 *   "summary": {
 *     "totalUsers": 5,
 *     "activeEndpoints": 10,
 *     "mostUsedEndpoint": "POST /2/tweets",
 *     "nextReset": "2024-02-23T10:00:00.000Z"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    console.log('📊 Hivemind Rate Limits Query Request');
    if (username) {
      console.log('   Username:', username);
    } else {
      console.log('   Scope: All users');
    }

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required - include X-API-Key header' },
        { status: 401 }
      );
    }

    // Validate Hivemind API key
    const hivemindConfig = await getHivemindConfig();

    if (!hivemindConfig || !hivemindConfig.enabled) {
      return NextResponse.json(
        { error: 'Hivemind is not enabled' },
        { status: 403 }
      );
    }

    if (hivemindConfig.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    let rateLimits;
    let summary = {};

    if (username) {
      // Get rate limits for specific user
      const user = await prisma.hivemindUser.findUnique({
        where: { username }
      });

      if (!user) {
        return NextResponse.json(
          { error: `User not found: ${username}` },
          { status: 404 }
        );
      }

      rateLimits = await getHivemindUserRateLimits(user.userId);

      // Create summary for single user
      summary = {
        username: user.username,
        displayName: user.displayName,
        totalEndpoints: rateLimits.length,
        mostUsedEndpoint: rateLimits.length > 0
          ? rateLimits.reduce((prev: any, current: any) =>
              (prev.percentageUsed > current.percentageUsed) ? prev : current
            ).endpoint
          : null,
        nextReset: rateLimits[0]?.reset || null
      };
    } else {
      // Get rate limits for all Hivemind users
      rateLimits = await getAllHivemindRateLimits();

      // Create summary for all users
      const uniqueUsers = new Set(rateLimits.map((rl: any) => rl.account.username));
      const uniqueEndpoints = new Set(rateLimits.map((rl: any) => rl.endpoint));

      // Find most used endpoint across all users
      const endpointUsage: Record<string, number> = {};
      rateLimits.forEach((rl: any) => {
        endpointUsage[rl.endpoint] = (endpointUsage[rl.endpoint] || 0) + rl.percentageUsed;
      });
      const mostUsedEndpoint = Object.entries(endpointUsage)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

      // Find next reset time
      const nextReset = rateLimits
        .map((rl: any) => rl.reset)
        .sort()[0] || null;

      summary = {
        totalUsers: uniqueUsers.size,
        activeEndpoints: uniqueEndpoints.size,
        mostUsedEndpoint,
        nextReset
      };
    }

    console.log('✅ Rate limits retrieved:', rateLimits.length, 'entries');

    return NextResponse.json({
      rateLimits,
      summary
    });
  } catch (error: any) {
    console.error('❌ Hivemind rate limits query error:', error.message);

    return NextResponse.json(
      {
        error: 'Failed to retrieve rate limits',
        message: error.message,
      },
      { status: 500 }
    );
  }
}