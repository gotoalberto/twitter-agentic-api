import { TwitterApi } from 'twitter-api-v2';
import { prisma } from './src/lib/db/prisma';
import { decrypt } from './src/lib/utils/encryption';

async function testTwitterCredentials() {
  const apiKey = 'bta_ca85e695b3e8c18f9716464165bf393598ceeb401cbfb274db4c2e3889b35a36';

  console.log('🔍 Fetching project and bot...');
  const project = await prisma.project.findFirst({
    where: { apiKey },
    include: { bot: true },
  });

  if (!project || !project.bot) {
    console.error('❌ Project or bot not found');
    return;
  }

  console.log('✅ Bot found:', project.bot.username);

  // Get Twitter API credentials from env
  const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
  const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

  if (!consumerKey || !consumerSecret) {
    console.error('❌ Missing Twitter API credentials in env');
    return;
  }

  console.log('✅ Twitter API credentials found in env');

  // Decrypt bot credentials
  console.log('🔓 Decrypting bot credentials...');
  try {
    const decryptedAccessToken = decrypt(project.bot.accessToken);
    const decryptedAccessSecret = decrypt(project.bot.accessTokenSecret);

    console.log('✅ Credentials decrypted successfully');
    console.log('   Access Token (first 10 chars):', decryptedAccessToken.substring(0, 10) + '...');
    console.log('   Access Secret (first 10 chars):', decryptedAccessSecret.substring(0, 10) + '...');

    // Create Twitter client
    console.log('\n🔧 Creating Twitter client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: decryptedAccessToken,
      accessSecret: decryptedAccessSecret,
    });

    // Test 1: Verify credentials
    console.log('\n🧪 TEST 1: Verifying credentials...');
    try {
      const me = await client.v2.me();
      console.log('✅ Credentials are valid!');
      console.log('   Bot ID:', me.data.id);
      console.log('   Bot username:', me.data.username);
      console.log('   Bot name:', me.data.name);
    } catch (error: any) {
      console.error('❌ Credentials verification failed');
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error details:', JSON.stringify(error.data || error.errors || {}, null, 2));
    }

    // Test 2: Lookup a user
    console.log('\n🧪 TEST 2: Looking up user "gotoalberto"...');
    try {
      const userResponse = await client.v2.userByUsername('gotoalberto', {
        'user.fields': ['id', 'name', 'username', 'created_at', 'public_metrics'],
      });
      console.log('✅ User lookup successful!');
      console.log('   User ID:', userResponse.data?.id);
      console.log('   Username:', userResponse.data?.username);
      console.log('   Name:', userResponse.data?.name);
    } catch (error: any) {
      console.error('❌ User lookup failed');
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error data:', JSON.stringify(error.data || error.errors || {}, null, 2));

      // Log full error object for debugging
      console.error('\n📋 Full error object:');
      console.error(JSON.stringify(error, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error during credential decryption or testing');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
  }

  await prisma.$disconnect();
}

testTwitterCredentials().catch(console.error);
