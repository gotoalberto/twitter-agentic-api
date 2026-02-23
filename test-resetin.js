// Test resetIn calculation
async function testResetIn() {
  try {
    const response = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': 'hm_FnbDNJrrZ7K8tFpTKvA5Xwh3GdR9YmQV'
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

        // Calculate what resetIn should be
        const resetTime = new Date(rl.reset).getTime();
        const now = Date.now();
        const calculatedResetIn = Math.max(0, Math.floor((resetTime - now) / 1000));

        console.log(`  Reset in (calculated): ${calculatedResetIn} seconds`);
        console.log(`  Difference: ${Math.abs(rl.resetIn - calculatedResetIn)} seconds`);

        // Convert to human readable
        const minutes = Math.floor(calculatedResetIn / 60);
        const seconds = calculatedResetIn % 60;
        console.log(`  Human readable: ${minutes} minutes and ${seconds} seconds`);
        console.log('');
      });
    } else {
      console.log('No rate limits found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testResetIn();