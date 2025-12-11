/**
 * Check webhook registration and subscription status
 */

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAHMn5wEAAAAARpCdThpwPZ1tNZiRP6OfowjCf7o=Go4WnMdCZKSP8p8TkmthUK2NNWbn5IwAgAyU1dGIcmkORMjeXq';

console.log('');
console.log('='.repeat(80));
console.log('🔍 CHECKING WEBHOOK STATUS');
console.log('='.repeat(80));
console.log('');

(async () => {
  try {
    // 1. List all webhooks
    console.log('1️⃣  Listing all registered webhooks...');
    console.log('');

    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR:', error);
      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Ignore
      }
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ SUCCESS!');
    console.log('');
    console.log('📦 Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (!data.data || data.data.length === 0) {
      console.log('⚠️  NO WEBHOOKS REGISTERED');
      console.log('');
      console.log('❌ This means Twitter is NOT sending events to your app.');
      console.log('');
      console.log('📝 ACTION REQUIRED:');
      console.log('   1. Go to https://bitso-twitter-api.vercel.app/dashboard');
      console.log('   2. Connect the bot');
      console.log('   3. Save the forwarding endpoint');
      console.log('   4. This will register the webhook automatically');
      console.log('');
      console.log('='.repeat(80));
      process.exit(1);
    }

    console.log('✅ FOUND', data.data.length, 'WEBHOOK(S)');
    console.log('');

    // Display each webhook
    for (let i = 0; i < data.data.length; i++) {
      const webhook = data.data[i];
      console.log('─'.repeat(80));
      console.log(`Webhook #${i + 1}`);
      console.log('─'.repeat(80));
      console.log('   ID:', webhook.id);
      console.log('   URL:', webhook.url);
      console.log('   Created:', webhook.created_at);
      console.log('   Valid:', webhook.valid ? '✅ YES' : '❌ NO');
      console.log('');

      // Check if this is our webhook
      if (webhook.url.includes('bitso-twitter-api.vercel.app')) {
        console.log('   🎯 THIS IS OUR WEBHOOK!');
        console.log('');

        if (!webhook.valid) {
          console.log('   ⚠️  WARNING: Webhook is INVALID');
          console.log('   Reason: CRC validation may have failed');
          console.log('   Twitter will NOT send events to invalid webhooks');
          console.log('');
        }

        // 2. Check subscription status (requires OAuth 1.0a, so we'll skip this for now)
        console.log('   ℹ️  To check subscription status, you need to use OAuth 1.0a');
        console.log('   This requires bot credentials, which are encrypted in Redis');
        console.log('');
        console.log('   📝 Subscription check:');
        console.log('      GET https://api.twitter.com/2/account_activity/webhooks/' + webhook.id + '/subscriptions/list');
        console.log('      (Requires OAuth 1.0a with bot credentials)');
        console.log('');
      } else {
        console.log('   ℹ️  This is NOT our webhook (different URL)');
        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log('✅ WEBHOOK STATUS CHECK COMPLETE');
    console.log('='.repeat(80));
    console.log('');

    // Summary
    const ourWebhook = data.data.find(w => w.url.includes('bitso-twitter-api.vercel.app'));
    if (ourWebhook) {
      if (ourWebhook.valid) {
        console.log('✅ RESULT: Webhook is registered and VALID');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Ensure bot is subscribed (check in dashboard)');
        console.log('   2. Send a tweet mentioning @bitsoonchain');
        console.log('   3. Check logs: vercel logs bitso-twitter-api.vercel.app --production');
        console.log('');
      } else {
        console.log('❌ RESULT: Webhook is registered but INVALID');
        console.log('');
        console.log('📝 Fix steps:');
        console.log('   1. Delete the webhook from dashboard');
        console.log('   2. Save the forwarding endpoint again');
        console.log('   3. This will re-register and validate the webhook');
        console.log('');
      }
    } else {
      console.log('❌ RESULT: Our webhook is NOT registered');
      console.log('');
      console.log('📝 Setup steps:');
      console.log('   1. Go to https://bitso-twitter-api.vercel.app/dashboard');
      console.log('   2. Connect the bot');
      console.log('   3. Save the forwarding endpoint');
      console.log('');
    }

  } catch (error) {
    console.log('❌ Exception:', error.message);
    console.log(error);
    process.exit(1);
  }
})();
