// Check TwitterApp credentials format
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkCredentials() {
  const apps = await prisma.twitterApp.findMany();

  console.log('TwitterApp Credentials Check:');
  console.log('================================\n');

  apps.forEach(app => {
    console.log(`App: ${app.name}`);
    console.log(`  ID: ${app.id}`);
    console.log(`  Consumer Key: ${app.consumerKey}`);
    console.log(`  Key Length: ${app.consumerKey.length} chars`);
    console.log(`  Has Secret: ${!!app.consumerSecret}`);
    console.log(`  Has Bearer: ${!!app.bearerToken}`);
    console.log('');

    // Check if it looks like OAuth 2.0 Client ID vs OAuth 1.0a API Key
    if (app.consumerKey.includes('-')) {
      console.log('  ⚠️  WARNING: Key contains dashes - might be OAuth 2.0 Client ID!');
      console.log('      You need the API Key (OAuth 1.0a), not Client ID (OAuth 2.0)');
    }

    if (app.consumerKey.length > 30) {
      console.log('  ⚠️  WARNING: Key is very long - might be wrong credential type!');
    }

    console.log('');
  });

  await prisma.$disconnect();
}

checkCredentials();