const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function checkTwitterApp(name) {
  try {
    console.log('================================================================================');
    console.log(`Checking TwitterApp: ${name}`);
    console.log('================================================================================\n');

    const app = await prisma.twitterApp.findUnique({
      where: { name },
      include: {
        projects: {
          include: {
            bot: true
          }
        }
      }
    });

    if (!app) {
      console.log('❌ TwitterApp not found!');
      return;
    }

    console.log('🔑 TwitterApp Credentials:');
    console.log(`   Name: ${app.name}`);
    console.log(`   ID: ${app.id}`);
    console.log('');
    console.log('   OAuth 1.0a:');
    console.log(`     Consumer Key: ${app.consumerKey ? '✅ Set' : '❌ Not set'}`);
    console.log(`     Consumer Secret: ${app.consumerSecret ? '✅ Set' : '❌ Not set'}`);
    console.log('');
    console.log('   OAuth 2.0:');
    console.log(`     Client ID: ${app.clientId ? '✅ Set' : '❌ Not set'}`);
    console.log(`     Client Secret: ${app.clientSecret ? '✅ Set' : '❌ Not set'}`);
    console.log('');
    console.log(`   Bearer Token: ${app.bearerToken ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Webhook Environment: ${app.webhookEnv}`);
    console.log(`   Created: ${app.createdAt}`);
    console.log('');

    console.log('📁 Projects using this app:');
    if (app.projects.length > 0) {
      app.projects.forEach(project => {
        console.log(`   - ${project.name} (${project.id})`);
        if (project.bot) {
          console.log(`     Bot: @${project.bot.username}`);
          console.log(`     OAuth 1.0a: ${project.bot.accessToken ? '✅' : '❌'}`);
          console.log(`     OAuth 2.0: ${project.bot.oauth2AccessToken ? '✅' : '❌'}`);
        } else {
          console.log(`     Bot: ❌ Not connected`);
        }
      });
    } else {
      console.log('   None');
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
  console.log('Usage: node check-twitter-app.js <app-name>');
  process.exit(1);
}

checkTwitterApp(appName);