import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: 'cmj4h4o5y0000gy04oss0g3o9' },
    include: {
      twitterApp: true,
      webhookRegistrations: true,
    }
  });

  console.log('=== PEPESDOG PROJECT INFO ===');
  console.log('Project ID:', project.id);
  console.log('Project Name:', project.name);
  console.log('');

  if (project.twitterApp) {
    console.log('TwitterApp:');
    console.log('  Name:', project.twitterApp.name);
    console.log('  ID:', project.twitterApp.id);
    console.log('  Has Bearer Token:', !!project.twitterApp.bearerToken);
    console.log('  Webhook Env:', project.twitterApp.webhookEnv);
  } else {
    console.log('TwitterApp: NULL (using env-var credentials)');
  }

  console.log('');
  console.log('Webhook Registrations:', project.webhookRegistrations.length);
  for (const webhook of project.webhookRegistrations) {
    console.log('  - ID:', webhook.webhookId);
    console.log('    URL:', webhook.url);
    console.log('    Subscribed:', webhook.subscribed);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());