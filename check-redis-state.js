/**
 * Check Redis state - bot, forwarding config, webhook registration
 */

const REDIS_URL = 'https://tidy-fish-21136.upstash.io';
const REDIS_TOKEN = 'AVKQAAIncDIyNTU5YTU0MGQ3MTA0MjQ2ODg0NDUyZTk5ODFjNWJlY3AyMjExMzY';

console.log('');
console.log('='.repeat(80));
console.log('🔍 CHECKING REDIS STATE');
console.log('='.repeat(80));
console.log('');

async function getRedisKey(key) {
  const response = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get key ${key}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

(async () => {
  try {
    console.log('1️⃣  Checking bot connection...');
    console.log('');

    const botData = await getRedisKey('bot:connected');

    if (!botData) {
      console.log('❌ NO BOT CONNECTED');
      console.log('');
      console.log('📝 ACTION REQUIRED:');
      console.log('   1. Go to https://bitso-twitter-api.vercel.app/dashboard');
      console.log('   2. Click "Connect Bot"');
      console.log('   3. Authorize @bitsoonchain');
      console.log('');
    } else {
      const bot = JSON.parse(botData);
      console.log('✅ BOT CONNECTED');
      console.log('');
      console.log('📦 Bot Data:');
      console.log('   User ID:', bot.userId);
      console.log('   Username:', bot.username);
      console.log('   Has access token:', !!bot.accessToken);
      console.log('   Has access secret:', !!bot.accessTokenSecret);
      console.log('   Encrypted:', !!bot.iv && !!bot.authTag);
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log('');

    console.log('2️⃣  Checking forwarding configuration...');
    console.log('');

    const forwardingData = await getRedisKey('config:forwarding');

    if (!forwardingData) {
      console.log('❌ NO FORWARDING CONFIG');
      console.log('');
      console.log('📝 ACTION REQUIRED:');
      console.log('   1. Go to https://bitso-twitter-api.vercel.app/dashboard');
      console.log('   2. Enter forwarding endpoint: https://goodboy.pepesdog.box/api/webhooks/twitter');
      console.log('   3. Enable forwarding');
      console.log('   4. Click "Save Configuration"');
      console.log('');
    } else {
      const config = JSON.parse(forwardingData);
      console.log('✅ FORWARDING CONFIGURED');
      console.log('');
      console.log('📦 Forwarding Config:');
      console.log('   Endpoint:', config.endpoint);
      console.log('   Enabled:', config.enabled ? '✅ YES' : '❌ NO');
      console.log('   Updated at:', config.updatedAt);
      console.log('');

      if (!config.enabled) {
        console.log('⚠️  WARNING: Forwarding is DISABLED');
        console.log('   Events will NOT be forwarded to goodboy');
        console.log('');
      }
    }

    console.log('─'.repeat(80));
    console.log('');

    console.log('3️⃣  Checking webhook registration...');
    console.log('');

    const webhookData = await getRedisKey('webhook:registration');

    if (!webhookData) {
      console.log('❌ NO WEBHOOK REGISTRATION');
      console.log('');
      console.log('📝 This is normal if you haven\'t saved the forwarding config yet');
      console.log('   The webhook gets registered when you save the forwarding config');
      console.log('');
    } else {
      const webhook = JSON.parse(webhookData);
      console.log('✅ WEBHOOK REGISTERED IN REDIS');
      console.log('');
      console.log('📦 Webhook Registration:');
      console.log('   Webhook ID:', webhook.webhookId);
      console.log('   URL:', webhook.url);
      console.log('   Bot User ID:', webhook.botUserId);
      console.log('   Bot Username:', webhook.botUsername);
      console.log('   Subscribed:', webhook.subscribed ? '✅ YES' : '❌ NO');
      console.log('   Registered at:', webhook.registeredAt);
      console.log('   Last CRC check:', webhook.lastCrcCheck || 'Never');
      console.log('');

      if (!webhook.subscribed) {
        console.log('⚠️  WARNING: Bot is NOT subscribed to webhook');
        console.log('   Twitter will NOT send events to this bot');
        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log('✅ REDIS STATE CHECK COMPLETE');
    console.log('='.repeat(80));
    console.log('');

    // Summary
    const botConnected = !!botData;
    const forwardingConfigured = !!forwardingData;
    const forwardingEnabled = forwardingData ? JSON.parse(forwardingData).enabled : false;
    const webhookRegistered = !!webhookData;
    const webhookSubscribed = webhookData ? JSON.parse(webhookData).subscribed : false;

    if (botConnected && forwardingConfigured && forwardingEnabled && webhookRegistered && webhookSubscribed) {
      console.log('✅ ALL SYSTEMS GO!');
      console.log('');
      console.log('📝 Everything is configured correctly:');
      console.log('   ✅ Bot is connected');
      console.log('   ✅ Forwarding is configured and enabled');
      console.log('   ✅ Webhook is registered');
      console.log('   ✅ Bot is subscribed to webhook');
      console.log('');
      console.log('🐦 Try sending a tweet mentioning @bitsoonchain');
      console.log('   You should see the webhook event in the logs');
      console.log('');
    } else {
      console.log('⚠️  INCOMPLETE SETUP');
      console.log('');
      console.log('📋 Checklist:');
      console.log(`   ${botConnected ? '✅' : '❌'} Bot connected`);
      console.log(`   ${forwardingConfigured ? '✅' : '❌'} Forwarding configured`);
      console.log(`   ${forwardingEnabled ? '✅' : '❌'} Forwarding enabled`);
      console.log(`   ${webhookRegistered ? '✅' : '❌'} Webhook registered`);
      console.log(`   ${webhookSubscribed ? '✅' : '❌'} Bot subscribed`);
      console.log('');

      if (!webhookSubscribed && botConnected && forwardingConfigured) {
        console.log('💡 LIKELY ISSUE: Bot is not subscribed to webhook');
        console.log('');
        console.log('📝 Fix steps:');
        console.log('   1. Go to https://bitso-twitter-api.vercel.app/dashboard');
        console.log('   2. Delete the forwarding configuration');
        console.log('   3. Save the forwarding configuration again');
        console.log('   4. This will re-subscribe the bot');
        console.log('');
      }
    }

  } catch (error) {
    console.log('❌ Exception:', error.message);
    console.log(error);
    process.exit(1);
  }
})();
