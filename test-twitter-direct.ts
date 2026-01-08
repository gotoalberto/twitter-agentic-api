import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from './src/lib/db/prisma';
import { decrypt } from './src/lib/utils/encryption';

async function testTwitterDirect() {
  console.log('🔍 Testing Twitter API credentials directly...\n');

  const apiKey = 'bta_ca85e695b3e8c18f9716464165bf393598ceeb401cbfb274db4c2e3889b35a36';

  // Get project and bot from database
  const project = await prisma.project.findFirst({
    where: { apiKey },
    include: { bot: true },
  });

  if (!project || !project.bot) {
    console.error('❌ Project or bot not found');
    await prisma.$disconnect();
    return;
  }

  console.log('✅ Project found:', project.name);
  console.log('✅ Bot found:', project.bot.username);
  console.log('   Bot User ID:', project.bot.userId);
  console.log('');

  // Get Twitter API credentials from env
  const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
  const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

  if (!consumerKey || !consumerSecret) {
    console.error('❌ Missing TWITTER_OAUTH_API_KEY or TWITTER_OAUTH_API_SECRET');
    await prisma.$disconnect();
    return;
  }

  console.log('✅ Twitter OAuth credentials found in env');
  console.log('   Consumer Key:', consumerKey.substring(0, 10) + '...');
  console.log('');

  // Decrypt bot credentials
  console.log('🔓 Decrypting bot OAuth tokens...');
  try {
    const decryptedAccessToken = decrypt(project.bot.accessToken);
    const decryptedAccessSecret = decrypt(project.bot.accessTokenSecret);

    console.log('✅ Bot tokens decrypted successfully');
    console.log('   Access Token (first 15 chars):', decryptedAccessToken.substring(0, 15) + '...');
    console.log('   Access Secret (first 15 chars):', decryptedAccessSecret.substring(0, 15) + '...');
    console.log('');

    // Create Twitter client
    console.log('🔧 Creating Twitter API client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: decryptedAccessToken,
      accessSecret: decryptedAccessSecret,
    });

    console.log('✅ Twitter client created');
    console.log('');

    // Test 1: Verify credentials with v2.me()
    console.log('================================================================================');
    console.log('🧪 TEST 1: Verifying bot credentials with v2.me()');
    console.log('================================================================================');
    try {
      const startTime = Date.now();
      const me = await client.v2.me();
      const duration = Date.now() - startTime;

      console.log('✅ SUCCESS - Bot credentials are valid!');
      console.log('   Response time:', duration + 'ms');
      console.log('   Bot ID:', me.data.id);
      console.log('   Bot username:', me.data.username);
      console.log('   Bot name:', me.data.name);
      console.log('');
    } catch (error: any) {
      console.error('❌ FAILED - Credential verification failed');
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error type:', error.type);
      if (error.data) {
        console.error('   Error data:', JSON.stringify(error.data, null, 2));
      }
      if (error.errors) {
        console.error('   Error errors:', JSON.stringify(error.errors, null, 2));
      }
      console.error('');
    }

    // Test 2: Lookup user "gotoalberto"
    console.log('================================================================================');
    console.log('🧪 TEST 2: Looking up user "gotoalberto"');
    console.log('================================================================================');
    try {
      const startTime = Date.now();
      const userResponse = await client.v2.userByUsername('gotoalberto', {
        'user.fields': [
          'id',
          'name',
          'username',
          'created_at',
          'description',
          'public_metrics',
          'verified',
          'verified_type',
          'protected',
          'profile_image_url',
          'url',
        ],
      });
      const duration = Date.now() - startTime;

      console.log('✅ SUCCESS - User lookup succeeded!');
      console.log('   Response time:', duration + 'ms');
      console.log('   User ID:', userResponse.data?.id);
      console.log('   Username:', userResponse.data?.username);
      console.log('   Name:', userResponse.data?.name);
      console.log('   Followers:', userResponse.data?.public_metrics?.followers_count || 0);
      console.log('');
    } catch (error: any) {
      console.error('❌ FAILED - User lookup failed');
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error type:', error.type);

      if (error.code === 402) {
        console.error('');
        console.error('   🚨 ERROR 402: PAYMENT REQUIRED');
        console.error('   This error typically means:');
        console.error('   1. Your Twitter API subscription has expired or is suspended');
        console.error('   2. Payment method on Twitter Developer Portal is invalid');
        console.error('   3. You need to upgrade your Twitter API plan');
        console.error('   4. Your Twitter Developer account requires payment');
        console.error('');
        console.error('   👉 ACTION REQUIRED:');
        console.error('   - Go to: https://developer.twitter.com/en/portal/dashboard');
        console.error('   - Check your API subscription status');
        console.error('   - Verify payment method is valid');
        console.error('   - Check if you need to pay outstanding balance');
        console.error('');
      }

      if (error.data) {
        console.error('   Error data:', JSON.stringify(error.data, null, 2));
      }
      if (error.errors) {
        console.error('   Error errors:', JSON.stringify(error.errors, null, 2));
      }
      if (error.rateLimit) {
        console.error('   Rate limit info:', JSON.stringify(error.rateLimit, null, 2));
      }
      console.error('');
      console.error('   Full error object:');
      console.error(JSON.stringify(error, null, 2));
      console.error('');
    }

    console.log('================================================================================');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error during testing');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
  }

  await prisma.$disconnect();
}

testTwitterDirect().catch(console.error);
