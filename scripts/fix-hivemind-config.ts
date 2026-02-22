import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function fixHivemindConfig() {
  console.log('🔧 Starting HivemindConfig cleanup...');

  try {
    // Get all configs
    const allConfigs = await prisma.hivemindConfig.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    console.log(`📊 Found ${allConfigs.length} configs:`, allConfigs);

    if (allConfigs.length === 0) {
      console.log('✅ No configs found, nothing to fix');
      return;
    }

    if (allConfigs.length === 1) {
      console.log('✅ Only one config exists, nothing to fix');
      return;
    }

    // Keep the most recently updated one
    const configToKeep = allConfigs[0];
    const configsToDelete = allConfigs.slice(1);

    console.log('📌 Config to keep:', {
      id: configToKeep.id,
      twitterAppId: configToKeep.twitterAppId,
      enabled: configToKeep.enabled,
      updatedAt: configToKeep.updatedAt
    });

    console.log('🗑️ Configs to delete:', configsToDelete.map(c => ({
      id: c.id,
      twitterAppId: c.twitterAppId,
      updatedAt: c.updatedAt
    })));

    // Delete all duplicates
    for (const config of configsToDelete) {
      await prisma.hivemindConfig.delete({
        where: { id: config.id }
      });
      console.log(`✅ Deleted config with id: ${config.id}`);
    }

    // Verify final state
    const finalConfigs = await prisma.hivemindConfig.findMany();
    console.log(`📊 Final state: ${finalConfigs.length} config(s)`, finalConfigs);

    if (finalConfigs.length !== 1) {
      throw new Error(`Expected 1 config but found ${finalConfigs.length}`);
    }

    console.log('✅ HivemindConfig cleanup completed successfully');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixHivemindConfig().catch(console.error);