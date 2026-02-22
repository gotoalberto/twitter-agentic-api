/**
 * Test webhook endpoint #1
 * This endpoint is for testing webhook registration
 * It properly handles CRC validation for X/Twitter webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// GET: CRC validation
export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get('crc_token');

  console.log('');
  console.log('🧪 TEST ENDPOINT 1 - CRC Request');
  console.log('   Timestamp:', new Date().toISOString());
  console.log('   CRC Token:', crcToken ? 'Received' : 'Missing');

  if (!crcToken) {
    return NextResponse.json({ error: 'crc_token required' }, { status: 400 });
  }

  // Use the consumer secret - hardcoded for this test
  // In production, this should come from environment variable
  const consumerSecret = '67Ph1dW5jqM7Br949DJA3RTYu24gLA6jBuyxYdJfHxPN4if25R';

  const hmac = crypto
    .createHmac('sha256', consumerSecret)
    .update(crcToken)
    .digest('base64');

  const responseToken = `sha256=${hmac}`;

  console.log('   ✅ CRC validation successful');
  console.log('');

  return NextResponse.json({ response_token: responseToken });
}

// POST: Receive webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('');
    console.log('🧪 TEST ENDPOINT 1 - Webhook Event Received');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Event keys:', Object.keys(body).join(', '));

    if (body.for_user_id) {
      console.log('   For User ID:', body.for_user_id);
    }

    if (body.tweet_create_events) {
      console.log('   Tweet events:', body.tweet_create_events.length);
    }

    console.log('   ✅ Event processed successfully');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Test endpoint 1 received webhook',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}