/**
 * Twitter Webhooks Endpoint - Per App (Account Activity API)
 *
 * GET: CRC (Challenge Response Check) validation - uses the app's consumerSecret
 * POST: Webhook event processing - routes events to the correct project
 *
 * The appId in the URL allows us to identify which TwitterApp's consumerSecret
 * to use for CRC validation, since each app registers its own webhook URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { getTwitterAppById } from '@/lib/db/twitter-apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET: CRC (Challenge Response Check) validation
 *
 * Twitter sends a CRC challenge to verify the webhook URL.
 * We look up the app by ID to get its consumerSecret for the HMAC.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const crcToken = request.nextUrl.searchParams.get('crc_token');

    console.log('');
    console.log('================================================================================');
    console.log('🔐 CRC VALIDATION REQUEST (GET)');
    console.log('================================================================================');
    console.log('   App ID:', appId);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   CRC Token:', crcToken ? crcToken.substring(0, 30) + '...' : 'NULL');
    console.log('');

    if (!crcToken) {
      return NextResponse.json({ error: 'crc_token parameter is required' }, { status: 400 });
    }

    // Look up the app to get its consumerSecret
    const app = await getTwitterAppById(appId);

    if (!app) {
      console.error('❌ CRC validation failed: Twitter App not found:', appId);
      return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
    }

    const hmac = crypto
      .createHmac('sha256', app.consumerSecret)
      .update(crcToken)
      .digest('base64');

    const responseToken = `sha256=${hmac}`;
    console.log('✅ CRC validation successful for app:', app.name);
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({ response_token: responseToken });
  } catch (error: any) {
    console.error('❌ CRC validation error:', error);
    return NextResponse.json({ error: 'Internal server error during CRC validation' }, { status: 500 });
  }
}

/**
 * POST: Webhook event processing
 *
 * Receives events from Twitter and delivers them to the appropriate project's endpoints.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const startTime = Date.now();
  const { appId } = await params;

  console.log('');
  console.log('🔔 INCOMING WEBHOOK EVENT');
  console.log('   Time:', new Date().toISOString());
  console.log('   App ID:', appId);

  try {
    const body = await request.json();
    const parseTime = Date.now() - startTime;

    console.log('');
    console.log('================================================================================');
    console.log('📨 WEBHOOK EVENT RECEIVED (POST)');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Parse time:', `${parseTime}ms`);
    console.log('   App ID:', appId);
    console.log('   Event keys:', Object.keys(body).join(', '));

    if (body.tweet_create_events) console.log('   Tweet events:', body.tweet_create_events.length);
    if (body.favorite_events) console.log('   Favorite events:', body.favorite_events.length);
    if (body.follow_events) console.log('   Follow events:', body.follow_events.length);
    if (body.direct_message_events) console.log('   DM events:', body.direct_message_events.length);
    if (body.for_user_id) console.log('   For user ID:', body.for_user_id);
    console.log('');

    // Forward webhook to project's endpoints
    try {
      const forUserId = body.for_user_id;

      if (!forUserId) {
        console.log('⚠️  FORWARDING SKIPPED: No for_user_id in payload');
      } else {
        console.log('🔍 LOOKING UP PROJECT FOR BOT');
        console.log('   Bot User ID:', forUserId);

        const bot = await prisma.bot.findUnique({
          where: { userId: forUserId },
          include: {
            project: {
              include: {
                forwardingEndpoints: true,
              },
            },
          },
        });

        if (!bot) {
          console.log(`⚠️  FORWARDING SKIPPED: No bot found for user ID: ${forUserId}`);
        } else {
          console.log(`   ✅ Bot found: @${bot.username}`);
          console.log(`   📁 Project: ${bot.project.name}`);

          const endpoints = bot.project.forwardingEndpoints;

          if (!endpoints || endpoints.length === 0) {
            console.log('⏭️  FORWARDING SKIPPED: No endpoints configured for project:', bot.project.name);
          } else {
            // Filter payload to events relevant to this bot
            const filteredPayload: any = { for_user_id: body.for_user_id };
            let eventType = 'unknown';
            let hasRelevantEvents = false;

            if (body.tweet_create_events?.length > 0) {
              filteredPayload.tweet_create_events = body.tweet_create_events;
              eventType = 'tweet_create_events';
              hasRelevantEvents = true;
            }
            if (body.direct_message_events?.length > 0) {
              filteredPayload.direct_message_events = body.direct_message_events;
              eventType = 'direct_message_events';
              hasRelevantEvents = true;
            }
            if (body.favorite_events?.length > 0) {
              const relevant = body.favorite_events.filter(
                (fav: any) => fav.favorited_status?.user?.id_str === forUserId
              );
              if (relevant.length > 0) {
                filteredPayload.favorite_events = relevant;
                eventType = 'favorite_events';
                hasRelevantEvents = true;
              }
            }
            if (body.follow_events?.length > 0) {
              const relevant = body.follow_events.filter(
                (follow: any) => follow.target?.id_str === forUserId
              );
              if (relevant.length > 0) {
                filteredPayload.follow_events = relevant;
                eventType = 'follow_events';
                hasRelevantEvents = true;
              }
            }

            if (!hasRelevantEvents) {
              console.log('⏭️  No relevant events for this bot after filtering');
            } else {
              try {
                const { deliverToAllEndpoints } = await import('@/lib/webhooks/delivery');
                await deliverToAllEndpoints(bot.project.id, eventType, filteredPayload);
                console.log('   ✅ Delivered to all endpoints. Event type:', eventType);
              } catch (deliveryError: any) {
                console.error('   ❌ Delivery failed:', deliveryError.message);
              }
            }
          }
        }
      }
    } catch (forwardError: any) {
      console.error('❌ ERROR FORWARDING WEBHOOK:', forwardError.message);
    }

    // Log tweet events
    if (body.tweet_create_events?.length > 0) {
      console.log('');
      console.log('🐦 TWEET CREATE EVENTS');
      for (const tweet of body.tweet_create_events) {
        console.log(`   Tweet ID: ${tweet.id_str} | @${tweet.user?.screen_name}: ${tweet.text?.substring(0, 80)}`);
      }
    }

    console.log('');
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
