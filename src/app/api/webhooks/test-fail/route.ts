/**
 * Test webhook endpoint that FAILS CRC validation
 * This endpoint is for testing what happens when CRC validation fails
 */

import { NextRequest, NextResponse } from 'next/server';

// GET: Invalid CRC response
export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get('crc_token');

  console.log('');
  console.log('🧪 TEST FAIL ENDPOINT - CRC Request');
  console.log('   Timestamp:', new Date().toISOString());
  console.log('   CRC Token:', crcToken ? 'Received' : 'Missing');
  console.log('   ❌ Returning INVALID response intentionally');
  console.log('');

  // Return invalid response to test failure scenario
  return NextResponse.json({
    error: 'This endpoint intentionally fails CRC validation'
  }, { status: 400 });
}

// POST: Should not receive events since CRC will fail
export async function POST(request: NextRequest) {
  console.log('');
  console.log('🧪 TEST FAIL ENDPOINT - Unexpected webhook event');
  console.log('   This should not happen if CRC validation failed');
  console.log('');

  return NextResponse.json({
    success: false,
    message: 'This endpoint should not receive webhooks'
  }, { status: 400 });
}