const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function checkProject(projectId) {
  try {
    console.log('================================================================================');
    console.log(`Checking project: ${projectId}`);
    console.log('================================================================================\n');

    // Get project with all relationships
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bot: true,
        twitterApp: true,
        webhookRegistrations: true,
        forwardingConfig: true,
        forwardingEndpoints: {
          orderBy: { priority: 'desc' }
        }
      }
    });

    if (!project) {
      console.log('❌ Project not found!');
      return;
    }

    // Project info
    console.log('📁 Project Info:');
    console.log(`   Name: ${project.name}`);
    console.log(`   Created: ${project.createdAt}`);
    console.log(`   API Enabled: ${project.apiEnabled}`);
    console.log(`   API Key: ${project.apiKey ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Twitter App: ${project.twitterApp ? project.twitterApp.name : '❌ None'}`);
    console.log('');

    // Bot info
    if (project.bot) {
      console.log('🤖 Bot Info:');
      console.log(`   Username: @${project.bot.username}`);
      console.log(`   User ID: ${project.bot.userId}`);
      console.log(`   Connected: ${project.bot.createdAt}`);
      console.log(`   OAuth 1.0a tokens: ${project.bot.accessToken ? '✅' : '❌'}`);
      console.log(`   OAuth 2.0 tokens: ${project.bot.oauth2AccessToken ? '✅' : '❌'}`);
    } else {
      console.log('🤖 Bot: ❌ Not connected');
    }
    console.log('');

    // Webhook registrations
    console.log('📡 Webhook Registrations:');
    if (project.webhookRegistrations.length > 0) {
      project.webhookRegistrations.forEach(webhook => {
        console.log(`   ID: ${webhook.webhookId}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Subscribed: ${webhook.subscribed ? '✅' : '❌'}`);
        console.log(`   Created: ${webhook.createdAt}`);
        console.log('   ---');
      });
    } else {
      console.log('   ❌ No webhook registrations found');
    }
    console.log('');

    // Forwarding config
    console.log('🔄 Forwarding Config:');
    if (project.forwardingConfig) {
      console.log(`   Endpoint: ${project.forwardingConfig.endpoint}`);
      console.log(`   Enabled: ${project.forwardingConfig.enabled ? '✅' : '❌'}`);
      console.log(`   Created: ${project.forwardingConfig.createdAt}`);
    } else {
      console.log('   ❌ No forwarding config');
    }
    console.log('');

    // Forwarding endpoints
    console.log('🎯 Forwarding Endpoints:');
    if (project.forwardingEndpoints.length > 0) {
      project.forwardingEndpoints.forEach(endpoint => {
        console.log(`   Name: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);
        console.log(`   Priority: ${endpoint.priority}`);
        console.log(`   Enabled: ${endpoint.enabled ? '✅' : '❌'}`);
        console.log('   ---');
      });
    } else {
      console.log('   ❌ No forwarding endpoints');
    }

    console.log('\n================================================================================');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get project ID from command line
const projectId = process.argv[2];
if (!projectId) {
  console.log('Usage: node check-project.js <project-id>');
  process.exit(1);
}

checkProject(projectId);