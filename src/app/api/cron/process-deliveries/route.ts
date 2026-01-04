/**
 * Cron Job: Process Pending Webhook Deliveries
 *
 * GET /api/cron/process-deliveries
 *
 * Automatically processes pending webhook deliveries
 * Designed to run every 2 minutes via Vercel Cron
 *
 * Authentication: Requires CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDeliveryQueue } from '@/lib/webhooks/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * GET: Process delivery queue (called by cron)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('');
    console.log('================================================================================');
    console.log('🤖 CRON: Processing webhook delivery queue');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Process up to 50 pending deliveries
    const processed = await processDeliveryQueue(undefined, undefined, 50);

    console.log('');
    console.log('✅ CRON: Processing complete');
    console.log('   Processed:', processed, 'deliveries');
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      processed,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('');
    console.error('================================================================================');
    console.error('❌ CRON: Error processing delivery queue');
    console.error('================================================================================');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('================================================================================');
    console.error('');

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
