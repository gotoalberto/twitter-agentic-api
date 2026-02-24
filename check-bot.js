const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkBot() {
  try {
    // Find the bot
    const bot = await prisma.bot.findFirst({
      where: { username: 'pepesdog_' },
      include: {
        project: true
      }
    });

    if (bot) {
      console.log('Bot found:');
      console.log('  Username:', bot.username);
      console.log('  ID:', bot.id);
      console.log('  Project ID:', bot.projectId);
      console.log('  Has OAuth 1.0a accessToken:', !!bot.accessToken);
      console.log('  Has OAuth 1.0a accessTokenSecret:', !!bot.accessTokenSecret);
      console.log('  Has OAuth 2.0 token:', !!bot.oauth2AccessToken);

      if (bot.project) {
        console.log('\nProject info:');
        console.log('  Name:', bot.project.name);
        console.log('  API Key:', bot.project.apiKey);
        console.log('  API Enabled:', bot.project.apiEnabled);
      }
    } else {
      console.log('Bot not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBot();