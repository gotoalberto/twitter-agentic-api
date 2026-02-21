const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function forceOAuth1ForApp(appName) {
  try {
    console.log('================================================================================');
    console.log(`Temporarily removing OAuth 2.0 credentials from: ${appName}`);
    console.log('This will force OAuth 1.0a flow for bot connections');
    console.log('================================================================================\n');

    // Get the app
    const app = await prisma.twitterApp.findUnique({
      where: { name: appName }
    });

    if (!app) {
      console.log('❌ TwitterApp not found!');
      return;
    }

    // Store current OAuth 2.0 credentials
    console.log('📝 Current OAuth 2.0 credentials:');
    console.log(`   Client ID: ${app.clientId ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Client Secret: ${app.clientSecret ? '✅ Set' : '❌ Not set'}`);

    if (app.clientId || app.clientSecret) {
      console.log('\n⚠️  SAVE THESE VALUES TO RESTORE LATER:');
      if (app.clientId) console.log(`   Client ID: ${app.clientId}`);
      if (app.clientSecret) console.log(`   Client Secret: [hidden for security]`);

      // Clear OAuth 2.0 credentials
      console.log('\n🔄 Clearing OAuth 2.0 credentials...');
      await prisma.twitterApp.update({
        where: { id: app.id },
        data: {
          clientId: null,
          clientSecret: null
        }
      });

      console.log('✅ OAuth 2.0 credentials cleared!');
      console.log('\n📌 NEXT STEPS:');
      console.log('1. Go to the project dashboard');
      console.log('2. Disconnect the current bot');
      console.log('3. Reconnect the bot - it will now use OAuth 1.0a');
      console.log('4. After successful connection, restore OAuth 2.0 credentials if needed');
    } else {
      console.log('\n✅ No OAuth 2.0 credentials to clear - OAuth 1.0a will be used by default');
    }

    console.log('\n================================================================================');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get app name from command line
const appName = process.argv[2];
if (!appName) {
  console.log('Usage: node force-oauth1.js <app-name>');
  process.exit(1);
}

forceOAuth1ForApp(appName);