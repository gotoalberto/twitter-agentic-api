/**
 * Project Rate Limits Query Endpoint
 *
 * GET: Retrieve current rate limit status for a project
 *
 * Returns rate limit information for all Twitter API endpoints
 * used by the project's bot account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';
import { getProjectRateLimits } from '@/lib/services/rate-limit-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET: Query rate limits for a project
 *
 * Response:
 * {
 *   "projectId": "project-id",
 *   "projectName": "project-name",
 *   "rateLimits": [
 *     {
 *       "account": {
 *         "id": "twitter-user-id",
 *         "username": "bot_handle"
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
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    console.log('📊 Rate Limits Query Request');
    console.log('   Project ID:', params.id);

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required - include X-API-Key header' },
        { status: 401 }
      );
    }

    // Get project
    const project = await getProjectById(params.id);

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

    // Check if project has API access
    if (!project.apiEnabled) {
      return NextResponse.json(
        { error: 'API access is disabled for this project' },
        { status: 403 }
      );
    }

    // Get rate limits for this project
    const rateLimits = await getProjectRateLimits(params.id);

    console.log('✅ Rate limits retrieved:', rateLimits.length, 'endpoints');

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      rateLimits: rateLimits,
    });
  } catch (error: any) {
    console.error('❌ Rate limits query error:', error.message);

    return NextResponse.json(
      {
        error: 'Failed to retrieve rate limits',
        message: error.message,
      },
      { status: 500 }
    );
  }
}