/**
 * Webhook Queue Processing Endpoint
 *
 * POST /api/webhooks/process-queue
 * POST /api/webhooks/process-queue?projectId=xxx
 *
 * Processes pending webhooks from the queue
 * Can be called manually or by a cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { processWebhookQueue } from '@/lib/webhooks/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

/**
 * POST: Process pending webhooks in the queue
 *
 * Query params:
 * - projectId (optional): Only process webhooks for this project
 * - limit (optional): Max number of webhooks to process (default: 10)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    console.log('');
    console.log('================================================================================');
    console.log('🎯 WEBHOOK QUEUE PROCESSING REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Project ID:', projectId || 'All projects');
    console.log('   Batch limit:', limit);
    console.log('');

    // Process the queue
    const processed = await processWebhookQueue(projectId, limit);

    console.log('');
    console.log('✅ QUEUE PROCESSING COMPLETE');
    console.log('   Webhooks processed:', processed);
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} webhook(s)`,
    });
  } catch (error: any) {
    console.error('');
    console.error('================================================================================');
    console.error('❌ QUEUE PROCESSING ERROR');
    console.error('================================================================================');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('================================================================================');
    console.error('');

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Failed to process webhook queue',
      },
      { status: 500 }
    );
  }
}
