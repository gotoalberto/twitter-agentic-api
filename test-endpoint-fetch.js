async function testEndpoint() {
  const tweetText = 'asdfsdfas';
  const suffix = '#COEDED BOX https://coeded.pepesdog.box/cards/test-' + Date.now();
  const fullText = `${tweetText}\n\n${suffix}`;

  const tweetRequest = {
    username: 'pepesdogbot',
    text: fullText,
  };

  console.log('Testing endpoint with fetch (like coeded does)');
  console.log('');
  console.log('Full text:');
  console.log(fullText);
  console.log('');
  console.log('JSON.stringify:');
  const body = JSON.stringify(tweetRequest);
  console.log(body);
  console.log('');

  try {
    const response = await fetch('https://bitso-twitter-api.vercel.app/api/twitter/tweet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'bta_c6340788bfe2592b16e6bb6566a1ee221c501d5b312696ec56a49856c6f90128',
      },
      body: body,
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEndpoint();
