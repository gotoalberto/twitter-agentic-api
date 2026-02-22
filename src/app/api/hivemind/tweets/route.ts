import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { TwitterApi } from 'twitter-api-v2';
import { decrypt } from '@/lib/utils/encryption';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = (session.user as any).username || (session.user as any).twitterHandle;
    if (!isAdmin(username)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const targetUsername = searchParams.get('username');
    const count = Math.min(parseInt(searchParams.get('count') || '10'), 100); // Max 100 tweets

    if (!targetUsername) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    // Find the bot user in our database
    const bot = await prisma.bot.findFirst({
      where: {
        username: targetUsername.toLowerCase()
      }
    });

    if (!bot) {
      return NextResponse.json(
        { error: 'User not found in Zeus Army network' },
        { status: 404 }
      );
    }

    // Check if the bot has valid credentials
    if (!bot.accessToken || !bot.accessTokenSecret) {
      return NextResponse.json(
        { error: 'User has not authorized Zeus Army access' },
        { status: 400 }
      );
    }

    // Decrypt the credentials
    const accessToken = await decrypt(bot.accessToken);
    const accessTokenSecret = await decrypt(bot.accessTokenSecret);

    // Initialize Twitter client with user credentials
    const client = new TwitterApi({
      appKey: process.env.TWITTER_OAUTH_API_KEY!,
      appSecret: process.env.TWITTER_OAUTH_API_SECRET!,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    });

    // Get user's timeline
    const timeline = await client.v2.userTimeline(bot.userId, {
      max_results: count,
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'referenced_tweets'],
      exclude: ['retweets', 'replies'] // Only original tweets
    });

    // Format the response
    const tweets = timeline.data?.data?.map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      metrics: {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        impressions: tweet.public_metrics?.impression_count || 0
      },
      url: `https://twitter.com/${targetUsername}/status/${tweet.id}`,
      is_pepesdog: tweet.text.toLowerCase().includes('pepesdog')
    })) || [];

    // Calculate stats
    const stats = {
      total_tweets: tweets.length,
      pepesdog_tweets: tweets.filter((t: any) => t.is_pepesdog).length,
      total_engagement: tweets.reduce((sum: number, t: any) =>
        sum + t.metrics.likes + t.metrics.retweets + t.metrics.replies, 0
      ),
      average_engagement: tweets.length > 0
        ? Math.round(tweets.reduce((sum: number, t: any) =>
            sum + t.metrics.likes + t.metrics.retweets + t.metrics.replies, 0) / tweets.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      user: {
        username: bot.username,
        userId: bot.userId,
        connectedAt: bot.createdAt
      },
      stats,
      tweets
    });

  } catch (error) {
    console.error('Error fetching user tweets:', error);

    if (error instanceof Error && error.message.includes('429')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
}

// New endpoint to get all Zeus Army members' recent activity
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = (session.user as any).username || (session.user as any).twitterHandle;
    if (!isAdmin(username)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await req.json();
    const { hours = 24 } = body; // Get tweets from last X hours

    // Get all connected bots
    const bots = await prisma.bot.findMany({
      where: {
        NOT: [
          { accessToken: '' },
          { accessTokenSecret: '' }
        ]
      },
      select: {
        id: true,
        username: true,
        userId: true,
        createdAt: true
      }
    });

    // Calculate time threshold
    const sinceTime = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

    // Summary data
    const summary = {
      total_members: bots.length,
      time_period_hours: hours,
      since: sinceTime,
      members: bots.map(bot => ({
        username: bot.username,
        userId: bot.userId,
        connectedAt: bot.createdAt
      })),
      note: 'Use GET /api/hivemind/tweets?username=USERNAME to get detailed tweets for each member'
    };

    return NextResponse.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Error fetching Zeus Army activity:', error);

    return NextResponse.json(
      { error: 'Failed to fetch Zeus Army activity' },
      { status: 500 }
    );
  }
}