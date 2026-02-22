// Test script for TwitterAPI.io API
// API Key: new1_e29f6a1fcd874dfda4cded2413ea9176
// Documentation: https://docs.twitterapi.io/

const API_KEY = 'new1_e29f6a1fcd874dfda4cded2413ea9176';
const BASE_URL = 'https://api.twitterapi.io';

// Search tweets using the advanced search endpoint
async function searchTweetsAdvanced(query) {
  try {
    console.log(`\n📍 Advanced Search for tweets about: "${query}"`);
    console.log('===================================');

    const url = `${BASE_URL}/twitter/tweet/advanced_search`;

    const params = new URLSearchParams({
      query: query,
      queryType: 'Latest'  // Options: 'Latest', 'Top', 'People', 'Photos', 'Videos'
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response Status:', response.status);

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log('✅ SUCCESS!');
      console.log(`Found ${data.data?.tweets?.length || 0} tweets\n`);

      if (data.data?.tweets && Array.isArray(data.data.tweets)) {
        data.data.tweets.slice(0, 5).forEach((tweet, index) => {
          console.log(`\n📝 Tweet ${index + 1}:`);
          console.log('-----------------------------------');
          console.log(`ID: ${tweet.id || tweet.tweet_id || 'N/A'}`);
          console.log(`Text: ${tweet.text || tweet.full_text || 'N/A'}`);
          console.log(`Author: @${tweet.user?.screen_name || tweet.author_screen_name || 'Unknown'}`);
          console.log(`Created: ${tweet.created_at || 'N/A'}`);
          console.log(`Likes: ${tweet.favorite_count || 0}, Retweets: ${tweet.retweet_count || 0}`);

          if (tweet.url) {
            console.log(`URL: ${tweet.url}`);
          }
        });
      }

      return data;
    } else {
      console.log('❌ Error:', data.message || 'Unknown error');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

// Get user's last tweets
async function getUserTweets(username) {
  try {
    console.log(`\n📍 Getting last tweets from @${username}`);
    console.log('===================================');

    const url = `${BASE_URL}/twitter/user/last_tweets`;

    const params = new URLSearchParams({
      userName: username
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response Status:', response.status);

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log('✅ SUCCESS!');
      console.log(`Found ${data.data?.tweets?.length || 0} tweets from @${username}\n`);

      if (data.data?.tweets && Array.isArray(data.data.tweets)) {
        data.data.tweets.slice(0, 3).forEach((tweet, index) => {
          console.log(`\n📝 Tweet ${index + 1}:`);
          console.log('-----------------------------------');
          console.log(`Text: ${tweet.text || tweet.full_text || 'N/A'}`);
          console.log(`Created: ${tweet.created_at || 'N/A'}`);
          console.log(`Likes: ${tweet.favorite_count || 0}, Retweets: ${tweet.retweet_count || 0}`);
        });
      }

      return data;
    } else {
      console.log('❌ Error:', data.message || 'Unknown error');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

// Get user profile
async function getUserProfile(username) {
  try {
    console.log(`\n📍 Getting profile for @${username}`);
    console.log('===================================');

    const url = `${BASE_URL}/twitter/user/info`;

    const params = new URLSearchParams({
      userName: username
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response Status:', response.status);

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log('✅ SUCCESS!');
      const user = data.data;
      console.log(`\n👤 User Profile:`);
      console.log('-----------------------------------');
      console.log(`Name: ${user.name}`);
      console.log(`Username: @${user.screen_name}`);
      console.log(`Bio: ${user.description || 'N/A'}`);
      console.log(`Followers: ${user.followers_count || 0}`);
      console.log(`Following: ${user.friends_count || 0}`);
      console.log(`Tweets: ${user.statuses_count || 0}`);
      console.log(`Verified: ${user.verified ? '✓' : '✗'}`);

      return data;
    } else {
      console.log('❌ Error:', data.message || 'Unknown error');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🐦 Testing TwitterAPI.io API');
  console.log('🔑 API Key:', API_KEY);
  console.log('📚 Documentation: https://docs.twitterapi.io/');
  console.log('===================================');

  try {
    // Test 1: Advanced search for pepesdog
    console.log('\n\n════════════════════════════════════');
    console.log('TEST 1: Search for "pepesdog" tweets');
    console.log('════════════════════════════════════');
    await searchTweetsAdvanced('pepesdog');

    // Test 2: Get tweets from pepesdog account (if exists)
    console.log('\n\n════════════════════════════════════');
    console.log('TEST 2: Get tweets from @pepesdog');
    console.log('════════════════════════════════════');
    await getUserTweets('pepesdog');

    // Test 3: Get pepesdog user profile
    console.log('\n\n════════════════════════════════════');
    console.log('TEST 3: Get @pepesdog profile');
    console.log('════════════════════════════════════');
    await getUserProfile('pepesdog');

    // Test 4: Search for pepesdog mentions with different query
    console.log('\n\n════════════════════════════════════');
    console.log('TEST 4: Search mentions of pepesdog');
    console.log('════════════════════════════════════');
    await searchTweetsAdvanced('@pepesdog OR pepesdog OR #pepesdog');

    console.log('\n\n✅ All tests completed!');
    console.log('===================================');

  } catch (error) {
    console.error('\n\n❌ Tests failed:', error.message);
  }
}

// Run the test
main().catch(console.error);