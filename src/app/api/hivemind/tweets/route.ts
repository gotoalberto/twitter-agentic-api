import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { TwitterApi } from 'twitter-api-v2';
import { decrypt } from '@/lib/utils/encryption';
import { prisma } from '@/lib/db/prisma';
import { getTwitterApiIoClient, TwitterApiIoClient } from '@/lib/twitter-api-io/client';

export async function GET(req: NextRequest) {
  try {
    // Check for API key first
    const apiKey = req.headers.get('x-api-key');
    let isAuthorized = false;

    if (apiKey && apiKey.startsWith('hm_')) {
      // Check Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (hivemindConfig && hivemindConfig.apiKey === apiKey) {
        isAuthorized = true;
      }
    }

    // If no valid API key, check session
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - API key or session required' },
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

      isAuthorized = true;
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

    // Use TwitterAPI.io to fetch tweets
    try {
      const twitterApiIoClient = getTwitterApiIoClient();

      console.log(`📚 Fetching tweets for ${targetUsername} via TwitterAPI.io...`);

      // Get user's recent tweets using TwitterAPI.io
      const tweetsResponse = await twitterApiIoClient.getUserTweets(targetUsername, count);

      // Format the response
      const tweets = tweetsResponse.tweets?.map((tweet: any) => {
        const convertedTweet = TwitterApiIoClient.convertTweetToApiFormat(tweet);

        // Check if this is a reply to another tweet
        const isReply = convertedTweet.referenced_tweets?.some((ref: any) => ref.type === 'replied_to') ||
                        convertedTweet.in_reply_to_user_id !== undefined;

        // Get the ID of the tweet being replied to (if it's a reply)
        const replyToId = convertedTweet.referenced_tweets?.find((ref: any) => ref.type === 'replied_to')?.id;

        return {
          id: convertedTweet.id,
          text: convertedTweet.text,
          created_at: convertedTweet.created_at,
          type: isReply ? 'reply' : 'tweet',
          is_reply: isReply,
          reply_to_id: replyToId || null,
          in_reply_to_user_id: convertedTweet.in_reply_to_user_id || null,
          metrics: {
            likes: convertedTweet.public_metrics?.like_count || 0,
            retweets: convertedTweet.public_metrics?.retweet_count || 0,
            replies: convertedTweet.public_metrics?.reply_count || 0,
            impressions: convertedTweet.public_metrics?.impression_count || 0
          },
          url: `https://twitter.com/${targetUsername}/status/${convertedTweet.id}`,
          is_pepesdog: convertedTweet.text?.toLowerCase().includes('pepesdog') || false
        };
      }) || [];

      console.log(`✅ Successfully fetched ${tweets.length} tweets via TwitterAPI.io`);

      // Calculate stats
      const stats = {
        total_tweets: tweets.length,
        original_tweets: tweets.filter((t: any) => !t.is_reply).length,
        replies: tweets.filter((t: any) => t.is_reply).length,
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

    } catch (twitterApiIoError: any) {
      console.log('⚠️ TwitterAPI.io failed, falling back to Twitter API...');
      console.error('   TwitterAPI.io error:', twitterApiIoError.message);

      // Fallback to Twitter API if TwitterAPI.io fails
      // Check if the bot has valid credentials for Twitter API
      if (!bot.accessToken || !bot.accessTokenSecret) {
        throw new Error('User has not authorized Zeus Army access');
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

      // Get user's timeline (including replies but not retweets)
      const timeline = await client.v2.userTimeline(bot.userId, {
        max_results: count,
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'referenced_tweets', 'in_reply_to_user_id'],
        exclude: ['retweets'] // Exclude retweets but include replies
      });

      // Format the response
      const tweets = timeline.data?.data?.map((tweet: any) => {
        // Check if this is a reply to another tweet
        const isReply = tweet.referenced_tweets?.some((ref: any) => ref.type === 'replied_to') ||
                        tweet.in_reply_to_user_id !== undefined;

        // Get the ID of the tweet being replied to (if it's a reply)
        const replyToId = tweet.referenced_tweets?.find((ref: any) => ref.type === 'replied_to')?.id;

        return {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          type: isReply ? 'reply' : 'tweet', // Indicate if it's a reply or a normal tweet
          is_reply: isReply,
          reply_to_id: replyToId || null, // ID of the tweet being replied to
          in_reply_to_user_id: tweet.in_reply_to_user_id || null,
          metrics: {
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
            impressions: tweet.public_metrics?.impression_count || 0
          },
          url: `https://twitter.com/${targetUsername}/status/${tweet.id}`,
          is_pepesdog: tweet.text.toLowerCase().includes('pepesdog')
        };
      }) || [];

      // Calculate stats
      const stats = {
        total_tweets: tweets.length,
        original_tweets: tweets.filter((t: any) => !t.is_reply).length,
        replies: tweets.filter((t: any) => t.is_reply).length,
        pepesdog_tweets: tweets.filter((t: any) => t.is_pepesdog).length,
        total_engagement: tweets.reduce((sum: number, t: any) =>
          sum + t.metrics.likes + t.metrics.retweets + t.metrics.replies, 0
        ),
        average_engagement: tweets.length > 0
          ? Math.round(tweets.reduce((sum: number, t: any) =>
              sum + t.metrics.likes + t.metrics.retweets + t.metrics.replies, 0) / tweets.length)
          : 0
      };

      console.log('✅ Fallback to Twitter API successful');

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
    }

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
    // Check for API key first
    const apiKey = req.headers.get('x-api-key');
    let isAuthorized = false;

    if (apiKey && apiKey.startsWith('hm_')) {
      // Check Hivemind API key
      const hivemindConfig = await prisma.hivemindConfig.findFirst();
      if (hivemindConfig && hivemindConfig.apiKey === apiKey) {
        isAuthorized = true;
      }
    }

    // If no valid API key, check session
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - API key or session required' },
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

      isAuthorized = true;
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