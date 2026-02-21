// Refresh bearer tokens for all TwitterApps
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function createBearerToken(consumerKey, consumerSecret) {
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

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
    throw new Error(`${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function refreshAllBearerTokens() {
  console.log('================================================================================');
  console.log('🔄 REFRESHING ALL BEARER TOKENS');
  console.log('================================================================================');
  console.log('');

  try {
    // Get all TwitterApps
    const twitterApps = await prisma.twitterApp.findMany({
      include: {
        projects: true
      }
    });

    console.log(`Found ${twitterApps.length} TwitterApp(s) in database`);
    console.log('');

    let successCount = 0;
    let failureCount = 0;

    for (const app of twitterApps) {
      console.log(`📱 Processing: ${app.name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Projects: ${app.projects?.map(p => p.name).join(', ') || 'None'}`);
      console.log(`   Consumer Key: ${app.consumerKey.substring(0, 8)}...`);

      try {
        // Generate new bearer token
        console.log('   Generating bearer token...');
        const newBearerToken = await createBearerToken(
          app.consumerKey,
          app.consumerSecret
        );

        console.log('   ✅ Bearer token generated successfully');
        console.log(`   Token: ${newBearerToken.substring(0, 30)}...`);

        // Update in database
        await prisma.twitterApp.update({
          where: { id: app.id },
          data: { bearerToken: newBearerToken }
        });

        console.log('   ✅ Bearer token updated in database');

        // Verify it works
        const verifyResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
          headers: {
            'Authorization': `Bearer ${newBearerToken}`
          }
        });

        if (verifyResponse.ok) {
          console.log('   ✅ Token verified - working correctly!');
          successCount++;
        } else {
          console.log('   ⚠️  Token generated but verification failed');
          failureCount++;
        }

      } catch (error) {
        console.log('   ❌ Failed to generate bearer token');
        console.log(`      Error: ${error.message}`);
        failureCount++;
      }

      console.log('');
    }

    // Summary
    console.log('================================================================================');
    console.log('📊 SUMMARY');
    console.log('================================================================================');
    console.log(`✅ Successfully refreshed: ${successCount} app(s)`);
    console.log(`❌ Failed to refresh: ${failureCount} app(s)`);

    if (failureCount > 0) {
      console.log('');
      console.log('⚠️  Some apps failed to refresh. Check that:');
      console.log('   1. The Consumer Key and Consumer Secret are correct');
      console.log('   2. The app has not been suspended on Twitter');
      console.log('   3. The app has the required permissions');
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
refreshAllBearerTokens();