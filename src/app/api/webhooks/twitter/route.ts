/**
 * Twitter Webhooks Endpoint (Account Activity API)
 *
 * GET: CRC (Challenge Response Check) validation
 * POST: Webhook event processing (SOLO LOGS - NO SE GUARDA EN REDIS)
 *
 * Documentation:
 * - https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/securing-webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Log on module load to confirm the endpoint is active
console.log('');
console.log('🚀 Twitter webhook endpoint loaded');
console.log('   Runtime:', 'nodejs');
console.log('   Max duration:', '60s');
console.log('   Time:', new Date().toISOString());
console.log('');

/**
 * GET: CRC (Challenge Response Check) validation
 *
 * Twitter sends a CRC challenge token to verify webhook ownership.
 * We forward this to goodboy and return its response.
 *
 * Request: GET /api/webhooks/twitter?crc_token=foo
 * Response: { "response_token": "sha256=base64_encoded_hash" }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const crcToken = searchParams.get('crc_token');

    console.log('');
    console.log('================================================================================');
    console.log('🔐 CRC VALIDATION REQUEST (GET)');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   URL:', request.url);
    console.log('   Method:', request.method);
    console.log('   CRC Token:', crcToken ? crcToken.substring(0, 30) + '...' : 'NULL');
    console.log('   Headers:');
    request.headers.forEach((value, key) => {
      console.log(`     ${key}: ${value}`);
    });
    console.log('');

    if (!crcToken) {
      console.error('❌ CRC validation failed: No crc_token provided');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'crc_token parameter is required' },
        { status: 400 }
      );
    }

    // Respond directly with CRC validation
    const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;
    if (!apiSecret) {
      console.error('❌ CRC validation failed: TWITTER_OAUTH_API_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    const hmac = crypto
      .createHmac('sha256', apiSecret)
      .update(crcToken)
      .digest('base64');

    const responseToken = `sha256=${hmac}`;
    console.log('✅ CRC validation successful');
    console.log('   Response token:', responseToken.substring(0, 30) + '...');
    console.log('================================================================================');
    console.log('');

    return NextResponse.json({ response_token: responseToken });
  } catch (error: any) {
    console.error('❌ CRC validation error:', error);
    console.error('   Stack:', error.stack);
    console.log('================================================================================');
    console.log('');

    return NextResponse.json(
      { error: 'Internal server error during CRC validation' },
      { status: 500 }
    );
  }
}

/**
 * POST: Webhook event processing
 *
 * IMPORTANTE: SOLO IMPRIMIR POR LOGS, NO GUARDAR EN REDIS
 *
 * Twitter sends various events when they occur on the subscribed account.
 * We're primarily interested in "tweet_create_events" for processing mentions.
 *
 * Event types:
 * - tweet_create_events: New tweets mentioning the bot
 * - favorite_events: Tweets favorited by the bot
 * - follow_events: New followers
 * - direct_message_events: DMs sent to the bot
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('');
  console.log('🔔 INCOMING REQUEST TO WEBHOOK ENDPOINT');
  console.log('   Time:', new Date().toISOString());
  console.log('   Method:', request.method);

  try {
    // Parse webhook payload
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());
    const parseTime = Date.now() - startTime;

    console.log('');
    console.log('================================================================================');
    console.log('📨 WEBHOOK EVENT RECEIVED (POST)');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Parse time:', `${parseTime}ms`);
    console.log('   Method:', request.method);
    console.log('   URL:', request.url);
    console.log('   Content-Length:', headers['content-length'] || 'unknown');
    console.log('');
    console.log('📋 ALL HEADERS:');
    Object.keys(headers).forEach(key => {
      console.log(`   ${key}: ${headers[key]}`);
    });
    console.log('');
    console.log('📦 RAW PAYLOAD:');
    console.log(JSON.stringify(body, null, 2));
    console.log('');
    console.log('📊 PAYLOAD ANALYSIS:');
    console.log('   Event keys:', Object.keys(body).join(', '));
    console.log('   Event count:', Object.keys(body).length);

    // Log specific event types
    if (body.tweet_create_events) {
      console.log('   Tweet events:', body.tweet_create_events.length);
    }
    if (body.favorite_events) {
      console.log('   Favorite events:', body.favorite_events.length);
    }
    if (body.follow_events) {
      console.log('   Follow events:', body.follow_events.length);
    }
    if (body.direct_message_events) {
      console.log('   DM events:', body.direct_message_events.length);
    }
    if (body.for_user_id) {
      console.log('   For user ID:', body.for_user_id);
    }
    console.log('');

    // Forward webhook to configured endpoint (project-specific)
    try {
      // Get the bot user ID from the webhook payload
      const forUserId = body.for_user_id;

      if (!forUserId) {
        console.log('');
        console.log('⚠️  FORWARDING SKIPPED');
        console.log('   Reason: No for_user_id in webhook payload, cannot determine project');
      } else {
        // Find which bot (and project) this webhook is for
        console.log('');
        console.log('🔍 LOOKING UP PROJECT FOR BOT');
        console.log('   Bot User ID:', forUserId);

        const bot = await prisma.bot.findUnique({
          where: { userId: forUserId },
          include: {
            project: {
              include: {
                forwardingEndpoints: true, // NEW: Get all endpoints
              },
            },
          },
        });

        if (!bot) {
          console.log('');
          console.log('⚠️  FORWARDING SKIPPED');
          console.log(`   Reason: No bot found for user ID: ${forUserId}`);
        } else {
          console.log(`   ✅ Bot found: @${bot.username}`);
          console.log(`   📁 Project: ${bot.project.name}`);

          const endpoints = bot.project.forwardingEndpoints;

          if (!endpoints || endpoints.length === 0) {
            console.log('');
            console.log('⏭️  FORWARDING SKIPPED');
            console.log('   Project:', bot.project.name);
            console.log('   Reason: No forwarding endpoints configured for this project');
          } else {
            console.log('');
            console.log('📥 DELIVERING WEBHOOK TO ALL ENDPOINTS');
            console.log('────────────────────────────────────────────────────────────────────────────────');
            console.log('   Project:', bot.project.name);
            console.log('   Bot:', `@${bot.username}`);
            console.log('   Endpoints:', endpoints.length);

            // Filter payload to only include events relevant to this bot
            const filteredPayload: any = {
              for_user_id: body.for_user_id,
            };

            let eventType = 'unknown';
            let hasRelevantEvents = false;

            // Filter tweet_create_events: Keep all (already filtered by for_user_id)
            if (body.tweet_create_events && body.tweet_create_events.length > 0) {
              filteredPayload.tweet_create_events = body.tweet_create_events;
              eventType = 'tweet_create_events';
              hasRelevantEvents = true;
            }

            // Filter direct_message_events: Keep all (already filtered by for_user_id)
            if (body.direct_message_events && body.direct_message_events.length > 0) {
              filteredPayload.direct_message_events = body.direct_message_events;
              eventType = 'direct_message_events';
              hasRelevantEvents = true;
            }

            // Filter favorite_events: Only where the favorited tweet belongs to our bot
            if (body.favorite_events && body.favorite_events.length > 0) {
              const relevantFavorites = body.favorite_events.filter((fav: any) =>
                fav.favorited_status?.user?.id_str === forUserId
              );
              if (relevantFavorites.length > 0) {
                filteredPayload.favorite_events = relevantFavorites;
                eventType = 'favorite_events';
                hasRelevantEvents = true;
                console.log(`   📊 Filtered favorite_events: ${body.favorite_events.length} → ${relevantFavorites.length}`);
              }
            }

            // Filter follow_events: Only where our bot is the TARGET (being followed)
            if (body.follow_events && body.follow_events.length > 0) {
              const relevantFollows = body.follow_events.filter((follow: any) =>
                follow.target?.id_str === forUserId
              );
              if (relevantFollows.length > 0) {
                filteredPayload.follow_events = relevantFollows;
                eventType = 'follow_events';
                hasRelevantEvents = true;
                console.log(`   📊 Filtered follow_events: ${body.follow_events.length} → ${relevantFollows.length}`);
              }
            }

            // Only forward if we have relevant events after filtering
            if (!hasRelevantEvents) {
              console.log('   ⏭️  No relevant events for this bot after filtering');
            } else {
              // Deliver to ALL endpoints
              try {
                const { deliverToAllEndpoints } = await import('@/lib/webhooks/delivery');

                await deliverToAllEndpoints(
                  bot.project.id,
                  eventType,
                  filteredPayload
                );

                console.log('   Event Type:', eventType);
              } catch (deliveryError: any) {
                console.error('   ❌ Failed to deliver webhook:', deliveryError.message);
                console.error('   Stack:', deliveryError.stack);
                // Continue execution - don't fail the whole webhook
              }
            }

            console.log('────────────────────────────────────────────────────────────────────────────────');
          }
        }
      }
    } catch (forwardError: any) {
      console.error('');
      console.error('❌ ERROR FORWARDING WEBHOOK');
      console.error('   Message:', forwardError.message);
      console.error('   Stack:', forwardError.stack);
      // Continue processing even if forwarding fails
    }

    // Process tweet_create_events
    if (body.tweet_create_events && body.tweet_create_events.length > 0) {
      console.log('');
      console.log('🐦 TWEET CREATE EVENTS');
      console.log('────────────────────────────────────────────────────────────────────────────────');

      for (const tweet of body.tweet_create_events) {
        console.log('');
        console.log('  📝 Tweet Details:');
        console.log('     Tweet ID:', tweet.id_str);
        console.log('     From:', `@${tweet.user.screen_name} (${tweet.user.name})`);
        console.log('     User ID:', tweet.user.id_str);
        console.log('     Text:', tweet.text);
        console.log('     Created at:', tweet.created_at);
        console.log('     Language:', tweet.lang);
        console.log('     Is retweet:', !!tweet.retweeted_status ? 'Yes' : 'No');
        console.log('     Is quote:', !!tweet.quoted_status ? 'Yes' : 'No');
        console.log('     Reply to:', tweet.in_reply_to_status_id_str || 'N/A');

        if (tweet.entities?.user_mentions && tweet.entities.user_mentions.length > 0) {
          console.log('     Mentions:', tweet.entities.user_mentions.map((m: any) => `@${m.screen_name}`).join(', '));
        }

        if (tweet.entities?.hashtags && tweet.entities.hashtags.length > 0) {
          console.log('     Hashtags:', tweet.entities.hashtags.map((h: any) => `#${h.text}`).join(', '));
        }

        if (tweet.entities?.urls && tweet.entities.urls.length > 0) {
          console.log('     URLs:', tweet.entities.urls.map((u: any) => u.expanded_url).join(', '));
        }

        // Additional user info
        console.log('');
        console.log('  👤 User Info:');
        console.log('     Followers:', tweet.user.followers_count);
        console.log('     Following:', tweet.user.friends_count);
        console.log('     Tweets:', tweet.user.statuses_count);
        console.log('     Verified:', tweet.user.verified ? 'Yes' : 'No');
        console.log('     Profile:', `https://twitter.com/${tweet.user.screen_name}`);
        console.log('     Tweet URL:', `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
      }

      console.log('');
      console.log('────────────────────────────────────────────────────────────────────────────────');
    }

    // Process favorite_events
    if (body.favorite_events && body.favorite_events.length > 0) {
      console.log('');
      console.log('❤️  FAVORITE EVENTS');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      for (const fav of body.favorite_events) {
        console.log(`  @${fav.user.screen_name} favorited tweet ${fav.favorited_status.id_str}`);
      }
      console.log('────────────────────────────────────────────────────────────────────────────────');
    }

    // Process follow_events
    if (body.follow_events && body.follow_events.length > 0) {
      console.log('');
      console.log('👥 FOLLOW EVENTS');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      for (const follow of body.follow_events) {
        console.log(`  @${follow.source.screen_name} → @${follow.target.screen_name}`);
      }
      console.log('────────────────────────────────────────────────────────────────────────────────');
    }

    // Process direct_message_events
    if (body.direct_message_events && body.direct_message_events.length > 0) {
      console.log('');
      console.log('💬 DIRECT MESSAGE EVENTS');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      for (const dm of body.direct_message_events) {
        console.log(`  From: ${dm.message_create.sender_id}`);
        console.log(`  Message: ${dm.message_create.message_data.text}`);
      }
      console.log('────────────────────────────────────────────────────────────────────────────────');
    }

    console.log('');
    console.log('================================================================================');
    console.log('');

    // Respond immediately to Twitter (must be within 3 seconds)
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);

    // Still return 200 to Twitter to avoid webhook deactivation
    // Log the error for debugging
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}
