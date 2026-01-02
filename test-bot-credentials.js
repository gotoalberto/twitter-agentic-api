/**
 * Test Bot Credentials
 *
 * This script verifies if the bot credentials are working correctly
 */

require('dotenv').config({ path: '.env.production.local' });
const { TwitterApi } = require('twitter-api-v2');
const { PrismaClient } = require('./src/generated/prisma');
const { decrypt } = require('./src/lib/utils/encryption');

const prisma = new PrismaClient();

async function testBotCredentials() {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🔍 TESTING BOT CREDENTIALS');
    console.log('================================================================================');
    console.log('');

    // Check environment variables
    const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
    const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

    console.log('📋 Environment Variables:');
    console.log('   TWITTER_OAUTH_API_KEY:', consumerKey ? '✅ Present' : '❌ Missing');
    console.log('   TWITTER_OAUTH_API_SECRET:', consumerSecret ? '✅ Present' : '❌ Missing');
    console.log('');

    if (!consumerKey || !consumerSecret) {
      throw new Error('Missing Twitter API credentials in environment');
    }

    // Get bot from database
    console.log('📦 Fetching bot from database...');
    const bot = await prisma.bot.findUnique({
      where: { username: 'pepesdogbot' },
    });

    if (!bot) {
      throw new Error('Bot not found in database');
    }

    console.log('✅ Bot found:', bot.username);
    console.log('   User ID:', bot.userId);
    console.log('   Project ID:', bot.projectId);
    console.log('');

    // Decrypt credentials
    console.log('🔓 Decrypting credentials...');
    const accessToken = decrypt(bot.accessToken);
    const accessTokenSecret = decrypt(bot.accessTokenSecret);
    console.log('   Access Token:', accessToken ? '✅ Decrypted' : '❌ Failed');
    console.log('   Access Token Secret:', accessTokenSecret ? '✅ Decrypted' : '❌ Failed');
    console.log('');

    // Initialize Twitter client
    console.log('🔑 Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    });

    // Test 1: Get user info (READ permission)
    console.log('');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('TEST 1: Get User Info (READ permission)');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    try {
      const user = await client.v2.me();
      console.log('✅ SUCCESS - Read permission working');
      console.log('   Username:', user.data.username);
      console.log('   Name:', user.data.name);
      console.log('   ID:', user.data.id);
    } catch (error) {
      console.error('❌ FAILED - Read permission error');
      console.error('   Error:', error.message);
      if (error.code) {
        console.error('   Code:', error.code);
      }
    }

    // Test 2: Try to post a test tweet (WRITE permission)
    console.log('');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('TEST 2: Post Tweet (WRITE permission)');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    const testTweetText = `Test tweet from credential verification script - ${new Date().toISOString()}`;
    console.log('   Attempting to post:', testTweetText.substring(0, 50) + '...');
    console.log('');

    try {
      const tweet = await client.v2.tweet(testTweetText);
      console.log('✅ SUCCESS - Write permission working');
      console.log('   Tweet ID:', tweet.data.id);
      console.log('   Tweet URL:', `https://twitter.com/${bot.username}/status/${tweet.data.id}`);
      console.log('');
      console.log('   ⚠️  CLEANUP: Deleting test tweet...');
      try {
        await client.v2.deleteTweet(tweet.data.id);
        console.log('   ✅ Test tweet deleted');
      } catch (deleteError) {
        console.warn('   ⚠️  Could not delete test tweet:', deleteError.message);
      }
    } catch (error) {
      console.error('❌ FAILED - Write permission error');
      console.error('   Error:', error.message);
      if (error.code) {
        console.error('   Code:', error.code);
      }
      if (error.data) {
        console.error('   Details:', JSON.stringify(error.data, null, 2));
      }
    }

    console.log('');
    console.log('================================================================================');
    console.log('✅ CREDENTIAL TEST COMPLETE');
    console.log('================================================================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('');
  } finally {
    await prisma.$disconnect();
  }
}

testBotCredentials();
