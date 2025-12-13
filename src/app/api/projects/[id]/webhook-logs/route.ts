/**
 * Webhook Logs API
 *
 * GET /api/projects/[id]/webhook-logs
 * Returns paginated webhook forwarding logs for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor'); // ID of last log from previous page
    const limit = 10; // Number of logs per page

    // Build query
    const where = { projectId };
    const orderBy = { createdAt: 'desc' as const };

    // Get logs with cursor-based pagination
    const logs = await prisma.webhookLog.findMany({
      where,
      orderBy,
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), // Skip the cursor itself
    });

    // Check if there are more logs
    const hasMore = logs.length > limit;
    const logsToReturn = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? logsToReturn[logsToReturn.length - 1].id : null;

    return NextResponse.json({
      logs: logsToReturn,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    console.error('Error fetching webhook logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook logs' },
      { status: 500 }
    );
  }
}
