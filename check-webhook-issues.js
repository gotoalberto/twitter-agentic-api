/**
 * Check webhook delivery issues for pepesdog_
 */

const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkWebhookIssues() {
  console.log('');
  console.log('================================================================================');
  console.log('🔍 CHECKING WEBHOOK DELIVERY ISSUES');
  console.log('================================================================================');
  console.log('');

  try {
    // Find pepesdog_ bot and project
    const bot = await prisma.bot.findUnique({
      where: { username: 'pepesdog_' },
      include: {
        project: {
          include: {
            forwardingConfig: true,
            webhookRegistrations: true,
          },
        },
      },
    });

    if (!bot) {
      console.log('❌ Bot "pepesdog_" not found');
      return;
    }

    console.log('✅ BOT FOUND');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log('  Username:', bot.username);
    console.log('  User ID:', bot.userId);
    console.log('  Project:', bot.project.name);
    console.log('  Project ID:', bot.project.id);
    console.log('');

    console.log('🔀 FORWARDING CONFIG');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    if (bot.project.forwardingConfig) {
      const config = bot.project.forwardingConfig;
      console.log('  Enabled:', config.enabled ? '✅' : '❌');
      console.log('  Endpoint:', config.endpoint);
    } else {
      console.log('  ❌ NO FORWARDING CONFIG');
    }
    console.log('');

    console.log('📡 WEBHOOK REGISTRATIONS');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    if (bot.project.webhookRegistrations.length > 0) {
      for (const reg of bot.project.webhookRegistrations) {
        console.log('  Webhook ID:', reg.webhookId);
        console.log('  URL:', reg.url);
        console.log('  Subscribed:', reg.subscribed ? '✅' : '❌');
      }
    } else {
      console.log('  ❌ NO WEBHOOK REGISTRATIONS');
    }
    console.log('');

    // Get recent webhook logs
    console.log('📨 RECENT WEBHOOK LOGS (last 20)');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const logs = await prisma.webhookLog.findMany({
      where: { projectId: bot.project.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (logs.length === 0) {
      console.log('  ℹ️  No webhook logs found');
    } else {
      console.log(`  Found ${logs.length} webhook log(s)`);
      console.log('');

      for (const log of logs) {
        console.log('  ┌─────────────────────────────────────────────────────────────────────────');
        console.log('  │ ID:', log.id);
        console.log('  │ Created:', log.createdAt.toISOString());
        console.log('  │ Event Type:', log.eventType);
        console.log('  │ Status:', log.status);
        console.log('  │ Forward URL:', log.forwardedTo);
        console.log('  │ Attempts:', log.attempts);

        if (log.statusCode) {
          console.log('  │ Status Code:', log.statusCode);
        }

        if (log.lastAttemptAt) {
          console.log('  │ Last Attempt:', log.lastAttemptAt.toISOString());
        }

        if (log.nextRetryAt) {
          const now = new Date();
          const retryIn = Math.round((log.nextRetryAt.getTime() - now.getTime()) / 1000);
          console.log('  │ Next Retry:', log.nextRetryAt.toISOString());
          console.log('  │ Retry in:', retryIn > 0 ? `${retryIn}s` : 'Ready now');
        }

        if (log.errorMessage) {
          console.log('  │ Error:', log.errorMessage);
        }

        if (log.deliveredAt) {
          console.log('  │ Delivered:', log.deliveredAt.toISOString());
        }

        console.log('  └─────────────────────────────────────────────────────────────────────────');
        console.log('');
      }
    }

    // Summary statistics
    console.log('📊 WEBHOOK STATISTICS');
    console.log('─────────────────────────────────────────────────────────────────────────────');

    const stats = await prisma.webhookLog.groupBy({
      by: ['status'],
      where: { projectId: bot.project.id },
      _count: true,
    });

    if (stats.length === 0) {
      console.log('  No webhooks to analyze');
    } else {
      for (const stat of stats) {
        console.log(`  ${stat.status}: ${stat._count} webhook(s)`);
      }
    }
    console.log('');

    // Check for failed webhooks
    const failedLogs = await prisma.webhookLog.findMany({
      where: {
        projectId: bot.project.id,
        status: 'pending',
        attempts: { gt: 0 },
      },
      orderBy: { attempts: 'desc' },
      take: 5,
    });

    if (failedLogs.length > 0) {
      console.log('⚠️  TOP FAILING WEBHOOKS');
      console.log('─────────────────────────────────────────────────────────────────────────────');
      for (const log of failedLogs) {
        console.log(`  Webhook ${log.id}`);
        console.log(`    Attempts: ${log.attempts}`);
        console.log(`    Error: ${log.errorMessage || 'Unknown'}`);
        console.log('');
      }
    }

    console.log('================================================================================');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkWebhookIssues();
