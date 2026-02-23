// Check Hivemind config
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkConfig() {
  try {
    const config = await prisma.hivemindConfig.findFirst();

    console.log('Hivemind Config:');
    console.log('================');
    console.log('Enabled:', config?.enabled);
    console.log('API Key:', config?.apiKey);
    console.log('Twitter App ID:', config?.twitterAppId);

    // Check if there are any users
    const users = await prisma.hivemindUser.findMany({
      select: {
        username: true,
        displayName: true,
        oauth2AccessToken: true,
        expiresAt: true
      }
    });

    console.log('\nHivemind Users:', users.length);
    users.forEach(u => {
      console.log(`- @${u.username} (${u.displayName})`);
      console.log(`  Has OAuth2: ${!!u.oauth2AccessToken}`);
      console.log(`  Expires: ${u.expiresAt?.toISOString() || 'N/A'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();