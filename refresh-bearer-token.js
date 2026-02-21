// Refresh bearer token for a TwitterApp
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function createBearerToken(consumerKey, consumerSecret) {
  // Encode consumer key and secret
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

  // Request bearer token from Twitter
  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create bearer token:', error);
    throw new Error(`Failed to create bearer token: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.token_type !== 'bearer') {
    throw new Error('Invalid token type received');
  }

  return data.access_token;
}

async function refreshBearerToken() {
  console.log('================================================================================');
  console.log('🔄 REFRESHING BEARER TOKEN');
  console.log('================================================================================');
  console.log('');

  try {
    // Get the project
    const projectId = 'cmj4h4o5y0000gy04oss0g3o9';
    console.log('1️⃣ Fetching project:', projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        twitterApp: true
      }
    });

    if (!project || !project.twitterApp) {
      console.log('❌ Project or TwitterApp not found');
      return;
    }

    const twitterApp = project.twitterApp;
    console.log('✅ Found TwitterApp:', twitterApp.name);
    console.log('');

    // Test current token
    console.log('2️⃣ Testing current bearer token...');
    if (twitterApp.bearerToken) {
      const testResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`
        }
      });

      if (testResponse.ok) {
        console.log('✅ Current token is still valid');
        const data = await testResponse.json();
        console.log('   Test successful - Twitter user ID:', data.data.id);
        return;
      } else {
        console.log('❌ Current token is expired or invalid');
        console.log('   Status:', testResponse.status);
      }
    } else {
      console.log('❌ No bearer token configured');
    }
    console.log('');

    // Generate new bearer token
    console.log('3️⃣ Generating new bearer token...');
    console.log('   Using consumer key:', twitterApp.consumerKey.substring(0, 5) + '...');

    try {
      const newBearerToken = await createBearerToken(
        twitterApp.consumerKey,
        twitterApp.consumerSecret
      );

      console.log('✅ Bearer token generated successfully');
      console.log('   Token:', newBearerToken.substring(0, 20) + '...');

      // Update in database
      await prisma.twitterApp.update({
        where: { id: twitterApp.id },
        data: { bearerToken: newBearerToken }
      });

      console.log('✅ Bearer token updated in database');
      console.log('');

      // Test new token
      console.log('4️⃣ Testing new bearer token...');
      const verifyResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
        headers: {
          'Authorization': `Bearer ${newBearerToken}`
        }
      });

      if (verifyResponse.ok) {
        console.log('✅ New token is working!');
        const data = await verifyResponse.json();
        console.log('   Test successful - Twitter user ID:', data.data.id);
      } else {
        console.log('❌ New token verification failed');
        console.log('   Status:', verifyResponse.status);
        const error = await verifyResponse.text();
        console.log('   Error:', error);
      }

    } catch (tokenError) {
      console.error('❌ Failed to generate bearer token:', tokenError.message);

      if (tokenError.message.includes('401') || tokenError.message.includes('403')) {
        console.log('');
        console.log('⚠️  The consumer key/secret appear to be invalid or revoked');
        console.log('   Please check the TwitterApp credentials in the database');
        console.log('');
        console.log('   Possible issues:');
        console.log('   1. The app might be suspended or deleted on Twitter');
        console.log('   2. The consumer key/secret might be incorrect');
        console.log('   3. The app might not have the required permissions');
      }
    }

  } catch (error) {
    console.error('❌ Failed:', error);
    console.error(error.stack);
  } finally {
    console.log('');
    console.log('================================================================================');
    await prisma.$disconnect();
  }
}

// Run
refreshBearerToken();