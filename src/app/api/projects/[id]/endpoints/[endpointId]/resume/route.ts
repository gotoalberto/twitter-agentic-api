import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { resumePausedDeliveries } from '@/lib/webhooks/delivery';

/**
 * POST: Resume paused deliveries for an endpoint
 * Called when an endpoint is re-enabled to process webhooks that were paused
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, endpointId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, endpointId } = await params;

    console.log('');
    console.log('=== RESUMING PAUSED DELIVERIES ===');
    console.log('   Project ID:', projectId);
    console.log('   Endpoint ID:', endpointId);

    const count = await resumePausedDeliveries(endpointId);

    console.log('=== RESUME COMPLETE ===');
    console.log('');

    return NextResponse.json({
      success: true,
      resumedCount: count,
      message: `${count} webhooks resumed and processing started`
    });
  } catch (error: any) {
    console.error('Error resuming deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to resume deliveries' },
      { status: 500 }
    );
  }
}
