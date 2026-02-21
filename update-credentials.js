// Update Twitter App credentials with the correct values
const { PrismaClient } = require('./src/generated/prisma');
const { encrypt } = require('./src/lib/utils/encryption');

const prisma = new PrismaClient();

// Set the encryption key environment variable (needed for encryption)
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-encryption-key-here';

async function updateCredentials() {
  console.log('================================================================================');
  console.log('🔄 UPDATING TWITTER APP CREDENTIALS');
  console.log('================================================================================');
  console.log('');

  // The correct credentials provided by the user
  const correctCredentials = {
    consumerKey: 'S9wjNTtnKTJxFepIKebEfEwRc',
    consumerSecret: '7sGbE4DrW3aTws7ZKeimiIcN9PAGxMewfHPUJZAyOTDrwhWL7P',
    bearerToken: 'AAAAAAAAAAAAAAAAAAAAALrj7gEAAAAANQwCGbVoCA4un2tISUOwR%2BAHWcw%3D99ZCrQef1CzQRGiiVUhajPpQUmcEDLM9zwNhSbyhgZArGY3Yvy'
  };

  try {
    // Find the Hivemind TwitterApp (or the one assigned to the project)
    const projectId = 'cmj4h4o5y0000gy04oss0g3o9';

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { twitterApp: true }
    });

    if (!project || !project.twitterApp) {
      console.log('❌ Project or TwitterApp not found');
      return;
    }

    const twitterApp = project.twitterApp;
    console.log('✅ Found TwitterApp:', twitterApp.name, `(${twitterApp.id})`);

    // Encrypt the correct credentials
    const encryptedConsumerKey = encrypt(correctCredentials.consumerKey);
    const encryptedConsumerSecret = encrypt(correctCredentials.consumerSecret);
    const encryptedBearerToken = encrypt(correctCredentials.bearerToken);

    console.log('');
    console.log('📝 Updating credentials...');
    console.log('   Consumer Key (plain): ', correctCredentials.consumerKey);
    console.log('   Consumer Key (encrypted): ', encryptedConsumerKey.substring(0, 50) + '...');
    console.log('');

    // Update the TwitterApp with the correct encrypted credentials
    await prisma.twitterApp.update({
      where: { id: twitterApp.id },
      data: {
        consumerKey: encryptedConsumerKey,
        consumerSecret: encryptedConsumerSecret,
        bearerToken: encryptedBearerToken
      }
    });

    console.log('✅ Credentials updated successfully!');
    console.log('');

    // Verify the update
    const updatedApp = await prisma.twitterApp.findUnique({
      where: { id: twitterApp.id }
    });

    console.log('📋 Verification:');
    console.log('   Stored Consumer Key Length:', updatedApp.consumerKey.length);
    console.log('   Contains colons:', updatedApp.consumerKey.includes(':') ? 'YES (encrypted)' : 'NO');

    // Test decryption
    const { decrypt } = require('./src/lib/utils/encryption');
    const decryptedKey = decrypt(updatedApp.consumerKey);
    console.log('   Decrypted Key:', decryptedKey);
    console.log('   Matches Input:', decryptedKey === correctCredentials.consumerKey ? '✅ YES' : '❌ NO');

  } catch (error) {
    console.error('❌ Failed to update credentials:', error);
    console.error(error.stack);
  } finally {
    console.log('');
    console.log('================================================================================');
    await prisma.$disconnect();
  }
}

// Run the update
updateCredentials();