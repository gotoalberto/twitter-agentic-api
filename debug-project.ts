import { prisma } from './src/lib/db/prisma';

async function debugProject() {
  const apiKey = 'bta_ca85e695b3e8c18f9716464165bf393598ceeb401cbfb274db4c2e3889b35a36';

  const project = await prisma.project.findFirst({
    where: {
      apiKey: apiKey,
    },
    include: {
      bot: true,
    },
  });

  console.log('Project found:', project ? 'YES' : 'NO');
  if (project) {
    console.log('Project ID:', project.id);
    console.log('Project Name:', project.name);
    console.log('API Enabled:', project.apiEnabled);
    console.log('Bot connected:', project.bot ? 'YES' : 'NO');
    if (project.bot) {
      console.log('Bot ID:', project.bot.id);
      console.log('Bot username:', project.bot.username);
      console.log('Bot userId:', project.bot.userId);
    }
  }

  await prisma.$disconnect();
}

debugProject().catch(console.error);
