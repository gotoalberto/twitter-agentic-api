import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function checkHivemindKey() {
  try {
    const hivemindConfig = await prisma.hivemindConfig.findFirst({
      select: {
        id: true,
        apiKey: true,
        enabled: true
      }
    });

    if (!hivemindConfig) {
      console.log('❌ No Hivemind config found in database');
      return;
    }

    console.log('=== Hivemind Configuration ===');
    console.log(`Enabled: ${hivemindConfig.enabled}`);
    console.log(`Stored API Key: ${hivemindConfig.apiKey || 'NOT SET'}`);
    console.log('');

    const providedKey = 'hm_4gP5N58-nA6QEWFM-H_GtCEpK_E2X_qI';
    console.log(`Provided API Key: ${providedKey}`);

    if (hivemindConfig.apiKey === providedKey) {
      console.log('✅ Keys MATCH!');
    } else {
      console.log('❌ Keys DO NOT MATCH!');
      console.log('');
      console.log('The API key in the database is different from the one you\'re using.');

      // Update the API key if needed
      console.log('\n=== Updating API Key ===');
      const updated = await prisma.hivemindConfig.update({
        where: { id: hivemindConfig.id },
        data: { apiKey: providedKey }
      });
      console.log('✅ API Key updated successfully!');
      console.log(`New API Key: ${updated.apiKey}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHivemindKey();