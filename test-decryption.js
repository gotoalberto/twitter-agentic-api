// Test decryption functionality
const crypto = require('crypto');

// Inline encryption/decryption functions (copied from src/lib/utils/encryption.ts)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'RceMyPq7xJg6+3/FZZRlmBFGlyEKLJh2dhTypeh5sW0=';

function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('Invalid encrypted text');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid encrypted format. Expected 3 parts, got ${parts.length}`);
  }

  const [iv, encrypted, authTag] = parts;

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function encrypt(text) {
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

async function testDecryption() {
  console.log('================================================================================');
  console.log('🔍 TESTING CREDENTIAL DECRYPTION');
  console.log('================================================================================');
  console.log('');

  const { PrismaClient } = require('./src/generated/prisma');
  const prisma = new PrismaClient();

  try {
    // Get the Hivemind TwitterApp
    const twitterApp = await prisma.twitterApp.findFirst({
      where: { name: 'Hivemind' }
    });

    if (!twitterApp) {
      console.log('❌ Hivemind TwitterApp not found');
      return;
    }

    console.log('✅ Found TwitterApp:', twitterApp.name);
    console.log('   ID:', twitterApp.id);
    console.log('');

    // Check raw stored values
    console.log('📦 Raw stored values:');
    console.log('   Consumer Key (encrypted):', twitterApp.consumerKey.substring(0, 50) + '...');
    console.log('   Length:', twitterApp.consumerKey.length);
    console.log('   Contains colons:', twitterApp.consumerKey.includes(':') ? 'YES' : 'NO');
    console.log('');

    // Test decryption
    try {
      const decryptedKey = decrypt(twitterApp.consumerKey);
      console.log('✅ Consumer Key decrypted successfully');
      console.log('   Decrypted:', decryptedKey);
      console.log('   Length:', decryptedKey.length);
    } catch (error) {
      console.log('❌ Failed to decrypt Consumer Key:', error.message);
      console.log('   This means the stored value is NOT encrypted');
      console.log('   Actual value:', twitterApp.consumerKey);
    }

    try {
      const decryptedSecret = decrypt(twitterApp.consumerSecret);
      console.log('✅ Consumer Secret decrypted successfully');
      console.log('   Length:', decryptedSecret.length);
    } catch (error) {
      console.log('❌ Failed to decrypt Consumer Secret:', error.message);
      console.log('   This means the stored value is NOT encrypted');
    }

    try {
      const decryptedBearer = decrypt(twitterApp.bearerToken);
      console.log('✅ Bearer Token decrypted successfully');
      console.log('   Token:', decryptedBearer.substring(0, 30) + '...');
    } catch (error) {
      console.log('❌ Failed to decrypt Bearer Token:', error.message);
      console.log('   This means the stored value is NOT encrypted');
      console.log('   Actual value:', twitterApp.bearerToken.substring(0, 50) + '...');
    }

    console.log('');
    console.log('📝 Testing encryption/decryption round-trip:');
    const testValue = 'S9wjNTtnKTJxFepIKebEfEwRc';
    const encrypted = encrypt(testValue);
    const decrypted = decrypt(encrypted);

    console.log('   Original:', testValue);
    console.log('   Encrypted:', encrypted.substring(0, 50) + '...');
    console.log('   Decrypted:', decrypted);
    console.log('   Match:', testValue === decrypted ? '✅ YES' : '❌ NO');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
    console.log('');
    console.log('================================================================================');
  }
}

// Run the test
testDecryption();