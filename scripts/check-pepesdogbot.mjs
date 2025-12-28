import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking project: pepesdogbot (cmjn22f3o0000lb04a8801vy9)\n');

  const project = await prisma.project.findUnique({
    where: { id: 'cmjn22f3o0000lb04a8801vy9' },
    include: {
      bot: true,
      forwardingConfig: true,
      webhookRegistrations: true
    }
  });

  if (!project) {
    console.log('❌ ERROR: Project not found!');
    return;
  }

  console.log('=== PROJECT INFO ===');
  console.log('Name:', project.name);
  console.log('ID:', project.id);
  console.log('');

  console.log('=== BOT INFO ===');
  if (project.bot) {
    console.log('✅ Bot configured');
    console.log('Username:', project.bot.username);
    console.log('User ID:', project.bot.userId);
    console.log('Bot ID:', project.bot.id);
  } else {
    console.log('❌ NO BOT CONFIGURED!');
  }
  console.log('');

  console.log('=== FORWARDING CONFIG ===');
  if (project.forwardingConfig) {
    console.log('✅ Forwarding configured');
    console.log('Endpoint:', project.forwardingConfig.endpoint);
    console.log('Enabled:', project.forwardingConfig.enabled);
  } else {
    console.log('❌ NO FORWARDING CONFIG!');
  }
  console.log('');

  console.log('=== WEBHOOK REGISTRATIONS ===');
  if (project.webhookRegistrations.length === 0) {
    console.log('❌ NO REGISTRATIONS FOUND!');
  } else {
    console.log('✅ Webhook registrations found:', project.webhookRegistrations.length);
    project.webhookRegistrations.forEach((reg, index) => {
      console.log('\nRegistration ' + (index + 1) + ':');
      console.log('  Webhook ID:', reg.webhookId);
      console.log('  URL:', reg.url);
      console.log('  Subscribed:', reg.subscribed);
      console.log('  Created:', reg.createdAt);
    });
  }
  console.log('');

  const logsCount = await prisma.webhookLog.count({
    where: { projectId: project.id }
  });

  console.log('=== WEBHOOK LOGS ===');
  console.log('Total logs:', logsCount);

  const recentLogs = await prisma.webhookLog.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (recentLogs.length === 0) {
    console.log('❌ NO LOGS FOUND - This means NO webhooks have been received from Twitter!');
    console.log('\n⚠️  ISSUE: The bot is not receiving webhooks from Twitter.');
    console.log('   Possible causes:');
    console.log('   1. Webhook not registered with Twitter');
    console.log('   2. Webhook subscription inactive');
    console.log('   3. Twitter is not sending events to the webhook URL');
  } else {
    console.log('\n✅ Recent logs found:');
    recentLogs.forEach((log, index) => {
      console.log('  ' + (index + 1) + '. ' + log.eventType + ' | ' + log.status + ' | ' + log.createdAt);
      console.log('     Forwarded to: ' + log.forwardedTo);
      if (log.errorMessage) {
        console.log('     Error: ' + log.errorMessage);
      }
    });
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
