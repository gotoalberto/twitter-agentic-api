/**
 * Check Forwarding Configuration in Database
 *
 * This script queries the database to show the current forwarding configuration
 * for all projects to help diagnose webhook forwarding issues.
 */

const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkForwardingConfig() {
  try {
    console.log('');
    console.log('==============================================================================');
    console.log('FORWARDING CONFIGURATION CHECK');
    console.log('==============================================================================');
    console.log('');

    // Get all projects with their bots and forwarding configs
    const projects = await prisma.project.findMany({
      include: {
        bot: true,
        forwardingConfig: true,
        webhookRegistrations: true,
      },
    });

    console.log(`Found ${projects.length} project(s)\n`);

    for (const project of projects) {
      console.log('------------------------------------------------------------------------------');
      console.log(`Project: ${project.name} (ID: ${project.id})`);
      console.log('------------------------------------------------------------------------------');

      if (project.bot) {
        console.log('Bot:');
        console.log(`  Username: @${project.bot.username}`);
        console.log(`  User ID: ${project.bot.userId}`);
        console.log(`  Created: ${project.bot.createdAt}`);
      } else {
        console.log('Bot: NOT CONNECTED');
      }

      console.log('');

      if (project.forwardingConfig) {
        console.log('Forwarding Config:');
        console.log(`  Endpoint: ${project.forwardingConfig.endpoint}`);
        console.log(`  Enabled: ${project.forwardingConfig.enabled ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Last updated: ${project.forwardingConfig.updatedAt}`);

        // Verify forwarding will work
        const willForward = project.forwardingConfig.enabled && project.forwardingConfig.endpoint && project.bot;
        console.log('');
        console.log(`  Will forward webhooks: ${willForward ? 'YES ✓' : 'NO ✗'}`);

        if (!willForward) {
          console.log('  Reason:');
          if (!project.forwardingConfig.enabled) {
            console.log('    - Forwarding is DISABLED');
          }
          if (!project.forwardingConfig.endpoint) {
            console.log('    - No endpoint configured');
          }
          if (!project.bot) {
            console.log('    - No bot connected');
          }
        }
      } else {
        console.log('Forwarding Config: NOT CONFIGURED');
      }

      console.log('');

      if (project.webhookRegistrations && project.webhookRegistrations.length > 0) {
        console.log('Webhook Registrations:');
        for (const reg of project.webhookRegistrations) {
          console.log(`  - Webhook ID: ${reg.webhookId}`);
          console.log(`    URL: ${reg.url}`);
          console.log(`    Subscribed: ${reg.subscribed ? 'YES ✓' : 'NO ✗'}`);
        }
      } else {
        console.log('Webhook Registrations: NONE');
      }

      console.log('');
    }

    console.log('==============================================================================');
    console.log('');
  } catch (error) {
    console.error('Error checking forwarding config:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkForwardingConfig();
