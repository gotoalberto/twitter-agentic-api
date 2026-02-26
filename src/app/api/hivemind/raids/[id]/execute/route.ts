import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST: Execute a raid - trigger likes and retweets from all Hivemind members
 *
 * This endpoint will:
 * 1. Find the raid by ID
 * 2. Get all active Hivemind members
 * 3. Trigger like and retweet actions for each member
 * 4. Update raid statistics
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const raidId = params.id;
    console.log('⚡ Executing raid:', raidId);

    // Find the raid
    const raid = await prisma.hivemindRaid.findUnique({
      where: { id: raidId }
    });

    if (!raid) {
      console.log('❌ Raid not found:', raidId);
      return NextResponse.json(
        {
          success: false,
          error: 'Raid not found'
        },
        { status: 404 }
      );
    }

    // Check if raid is already processed or processing
    if (raid.status !== 'pending') {
      console.log(`⚠️ Raid already ${raid.status}:`, raidId);
      return NextResponse.json({
        success: true,
        message: `Raid is already ${raid.status}`,
        raidId
      });
    }

    // Update raid status to processing
    await prisma.hivemindRaid.update({
      where: { id: raidId },
      data: {
        status: 'processing',
        processedAt: new Date()
      }
    });

    // Get all active Hivemind members
    const activeMembers = await prisma.hivemindUser.findMany({
      where: {
        isActive: true
      },
      select: {
        userId: true,
        username: true,
        displayName: true
      }
    });

    console.log(`📊 Found ${activeMembers.length} active members for raid`);

    // Process the raid asynchronously
    processRaidAsync(raidId, raid.tweetId, activeMembers).catch(error => {
      console.error('❌ Error in async raid processing:', error);
    });

    return NextResponse.json({
      success: true,
      message: `Raid started. ${activeMembers.length} members will engage with the tweet.`,
      raidId,
      membersCount: activeMembers.length
    });

  } catch (error) {
    console.error('❌ Error executing raid:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute raid'
      },
      { status: 500 }
    );
  }
}

/**
 * Process raid asynchronously
 * This function runs in the background to execute likes and retweets
 */
async function processRaidAsync(
  raidId: string,
  tweetId: string,
  members: Array<{ userId: string; username: string; displayName: string }>
) {
  console.log(`🚀 Starting async raid processing for ${raidId}`);

  let successfulLikes = 0;
  let successfulRetweets = 0;
  let failedActions = 0;

  // Get the base URL from environment
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hive.pepes.dog';

  // Get Hivemind API key
  const hivemindConfig = await prisma.hivemindConfig.findFirst();
  if (!hivemindConfig?.apiKey) {
    console.error('❌ No Hivemind API key configured');
    await updateRaidStatus(raidId, 'failed', 0, 0, members.length * 2, 'No Hivemind API key configured');
    return;
  }

  // Process each member
  for (const member of members) {
    console.log(`Processing actions for @${member.username}`);

    // Trigger like
    try {
      const likeResponse = await fetch(`${baseUrl}/api/hivemind/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': hivemindConfig.apiKey
        },
        body: JSON.stringify({
          tweetId,
          userId: member.userId,
          username: member.username
        })
      });

      if (likeResponse.ok) {
        successfulLikes++;
        console.log(`✅ Like successful for @${member.username}`);
      } else {
        failedActions++;
        console.log(`❌ Like failed for @${member.username}`);
      }
    } catch (error) {
      failedActions++;
      console.error(`❌ Like error for @${member.username}:`, error);
    }

    // Trigger retweet
    try {
      const retweetResponse = await fetch(`${baseUrl}/api/hivemind/retweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': hivemindConfig.apiKey
        },
        body: JSON.stringify({
          tweetId,
          userId: member.userId,
          username: member.username
        })
      });

      if (retweetResponse.ok) {
        successfulRetweets++;
        console.log(`✅ Retweet successful for @${member.username}`);
      } else {
        failedActions++;
        console.log(`❌ Retweet failed for @${member.username}`);
      }
    } catch (error) {
      failedActions++;
      console.error(`❌ Retweet error for @${member.username}:`, error);
    }

    // Add a small delay between members to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Update raid status
  const status = failedActions === 0 ? 'completed' :
                 (successfulLikes + successfulRetweets) > 0 ? 'completed' : 'failed';

  await updateRaidStatus(
    raidId,
    status,
    successfulLikes,
    successfulRetweets,
    failedActions
  );

  console.log(`✅ Raid ${raidId} completed:`, {
    successfulLikes,
    successfulRetweets,
    failedActions,
    status
  });
}

/**
 * Update raid status in database
 */
async function updateRaidStatus(
  raidId: string,
  status: string,
  likes: number,
  retweets: number,
  failed: number,
  errorMessage?: string
) {
  try {
    await prisma.hivemindRaid.update({
      where: { id: raidId },
      data: {
        status,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : null,
        likesCount: likes,
        retweetsCount: retweets,
        failedCount: failed,
        errorMessage
      }
    });
  } catch (error) {
    console.error('❌ Failed to update raid status:', error);
  }
}