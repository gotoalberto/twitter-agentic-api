// Test resetIn calculation after making an API call
async function testResetInWithCall() {
  try {
    const apiKey = 'hm_FnbDNJrrZ7K8tFpTKvA5Xwh3GdR9YmQV';

    // Try to make a like to trigger rate limit
    console.log('Making API call to trigger rate limit info...\n');
    const likeResponse = await fetch('https://hive.pepes.dog/api/twitter/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: '1861080853536538854',
        action: 'like'
      })
    });

    const likeData = await likeResponse.json();
    console.log('API Response Status:', likeResponse.status);

    // Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now fetch rate limits
    console.log('\nFetching rate limits...\n');
    const response = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const data = await response.json();

    console.log('Current time:', new Date().toISOString());
    console.log('');

    if (data.rateLimits && data.rateLimits.length > 0) {
      data.rateLimits.forEach(rl => {
        console.log(`Endpoint: ${rl.endpoint}`);
        console.log(`  Reset time: ${rl.reset}`);
        console.log(`  Reset in (from API): ${rl.resetIn} seconds`);

        // Calculate what resetIn should be locally
        const resetTime = new Date(rl.reset).getTime();
        const now = Date.now();
        const calculatedResetIn = Math.max(0, Math.floor((resetTime - now) / 1000));

        console.log(`  Reset in (calculated locally): ${calculatedResetIn} seconds`);

        const difference = Math.abs(rl.resetIn - calculatedResetIn);
        console.log(`  Difference: ${difference} seconds`);

        // Convert to human readable
        const minutes = Math.floor(rl.resetIn / 60);
        const seconds = rl.resetIn % 60;
        console.log(`  Human readable: ${minutes} minutes and ${seconds} seconds`);

        if (difference > 5) {
          console.log(`  ⚠️ WARNING: Difference is more than 5 seconds!`);
        } else {
          console.log(`  ✅ Calculation is accurate (within 5 seconds tolerance)`);
        }
        console.log('');
      });
    } else {
      console.log('No rate limits found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testResetInWithCall();