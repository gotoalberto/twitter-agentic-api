'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HivemindAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hivemindConfig, setHivemindConfig] = useState<any>(null);
  const [hivemindUsers, setHivemindUsers] = useState<any[]>([]);
  const [hivemindStats, setHivemindStats] = useState<any>(null);
  const [twitterApps, setTwitterApps] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Accordion states for API documentation
  const [postTweetDocsOpen, setPostTweetDocsOpen] = useState(false);
  const [getUsersDocsOpen, setGetUsersDocsOpen] = useState(false);
  const [getTweetsDocsOpen, setGetTweetsDocsOpen] = useState(false);
  const [replyDocsOpen, setReplyDocsOpen] = useState(false);
  const [getMembersDocsOpen, setGetMembersDocsOpen] = useState(false);
  const [getStatsDocsOpen, setGetStatsDocsOpen] = useState(false);
  const [postVideoDocsOpen, setPostVideoDocsOpen] = useState(false);
  const [retweetDocsOpen, setRetweetDocsOpen] = useState(false);
  const [likeDocsOpen, setLikeDocsOpen] = useState(false);
  const [rateLimitsDocsOpen, setRateLimitsDocsOpen] = useState(false);
  const [checkRateLimitsDocsOpen, setCheckRateLimitsDocsOpen] = useState(false);
  const [rateLimitErrorDocsOpen, setRateLimitErrorDocsOpen] = useState(false);
  const [uploadDocsOpen, setUploadDocsOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadHivemindData();
    }
  }, [status]);

  const loadHivemindData = async () => {
    try {
      // Load Hivemind configuration
      const configRes = await fetch('/api/hivemind/config');
      if (configRes.ok) {
        const config = await configRes.json();
        setHivemindConfig(config);
        // Keep null as null, don't convert to empty string
        setSelectedAppId(config?.twitterAppId || null);
        setIsEnabled(config?.enabled || false);
      }

      // Load API key
      const keyRes = await fetch('/api/hivemind/api-key');
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setApiKey(keyData.apiKey);
        setShowApiKey(keyData.full === true);
      }

      // Load Hivemind users
      const usersRes = await fetch('/api/hivemind/users');
      if (usersRes.ok) {
        const users = await usersRes.json();
        setHivemindUsers(users);
      }

      // Load Hivemind stats
      const statsRes = await fetch('/api/hivemind/stats');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setHivemindStats(stats);
      }

      // Load available Twitter apps
      const appsRes = await fetch('/api/twitter-apps');
      if (appsRes.ok) {
        const data = await appsRes.json();
        setTwitterApps(data.apps || []);
      }
    } catch (error) {
      console.error('Error loading Hivemind data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!confirm('Are you sure you want to generate a new API key? The old key will be invalidated.')) {
      return;
    }

    setIsGeneratingKey(true);
    try {
      const response = await fetch('/api/hivemind/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        setShowApiKey(true);
        alert('New API key generated! Make sure to copy it now - you won\'t be able to see it again in full.');
      } else {
        throw new Error('Failed to generate API key');
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      alert('Failed to generate API key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCopyApiKey = () => {
    if (apiKey && showApiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API key copied to clipboard!');
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/hivemind/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twitterAppId: selectedAppId || null,
          enabled: isEnabled,
        }),
      });

      if (response.ok) {
        const config = await response.json();
        setHivemindConfig(config);
        alert('Hivemind configuration saved successfully!');
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving Hivemind config:', error);
      alert('Failed to save Hivemind configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Hivemind Management</h1>
              <p className="text-gray-600 mt-2">Configure and monitor the Hivemind network</p>
            </div>
            <a
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        {hivemindStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Total Users</div>
              <div className="text-3xl font-bold text-gray-900">{hivemindStats.totalUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Active Users</div>
              <div className="text-3xl font-bold text-green-600">{hivemindStats.activeUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Inactive Users</div>
              <div className="text-3xl font-bold text-gray-400">{hivemindStats.inactiveUsers}</div>
            </div>
          </div>
        )}

        {/* API Key Management */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">API Key Management</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hivemind API Key
                </label>
                {apiKey ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={apiKey}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                      />
                      {showApiKey && (
                        <button
                          onClick={handleCopyApiKey}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition duration-200"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    {showApiKey && (
                      <p className="text-sm text-yellow-600">
                        ⚠️ Save this key now! You won't be able to see it again in full.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No API key generated yet</p>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleGenerateApiKey}
                  disabled={isGeneratingKey}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  {isGeneratingKey ? 'Generating...' : apiKey ? 'Regenerate API Key' : 'Generate API Key'}
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <h3 className="font-medium text-gray-900 mb-4">API Documentation</h3>

                {/* Post Tweet Accordion */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg">
                  <button
                    onClick={() => setPostTweetDocsOpen(!postTweetDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-purple-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-purple-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                      Post Tweets API
                    </span>
                    <svg
                      className={`w-5 h-5 text-purple-600 transition-transform ${postTweetDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {postTweetDocsOpen && (
                    <div className="p-4 border-t border-purple-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Publish tweets through any Zeus Army member:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/twitter/tweet/v2
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "username": "user_handle",
  "text": "Check out #PEPESDOG - the next big thing!",
  "imageUrl": "https://example.com/pepesdog-image.jpg"
}`}
                      </pre>
                      <div className="mt-3 text-xs text-gray-600">
                        <p className="font-semibold mb-1">Media URL support:</p>
                        <ul className="ml-4 space-y-1">
                          <li>• Use imageUrl for image URLs (Twitter will show preview)</li>
                          <li>• Use videoUrl for video URLs (Twitter will show preview)</li>
                          <li>• URLs are appended to tweet text and count as 23 characters</li>
                          <li>• Only one media URL per tweet (image OR video)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Upload Accordion */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg">
                  <button
                    onClick={() => setUploadDocsOpen(!uploadDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-amber-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                      </svg>
                      Upload Image to S3 API
                    </span>
                    <svg
                      className={`w-5 h-5 text-amber-600 transition-transform ${uploadDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {uploadDocsOpen && (
                    <div className="p-4 border-t border-amber-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Upload images to AWS S3 and get a public URL for tweeting:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/upload/image
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQ...",
  "filename": "pepesdog-logo.jpg"  // Optional
}

Response:
{
  "success": true,
  "url": "https://pepesdog-uploads.s3.us-east-1.amazonaws.com/images/1734567890-abc123-pepesdog-logo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "key": "images/1734567890-abc123-pepesdog-logo.jpg"
}

Note: The URL is a pre-signed URL valid for 7 days`}
                      </pre>
                      <div className="mt-3 text-xs text-gray-600">
                        <p className="font-semibold mb-1">Complete workflow example:</p>
                        <pre className="bg-gray-700 text-gray-100 p-2 rounded overflow-x-auto">
{`# 1. Upload image
IMAGE_URL=$(curl -X POST https://hive.pepes.dog/api/upload/image \\
  -H "X-API-Key: ${apiKey || '<your-api-key>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"imageData":"data:image/jpeg;base64,..."}' | jq -r '.url')

# 2. Post tweet with image
curl -X POST https://hive.pepes.dog/api/twitter/tweet/v2 \\
  -H "X-API-Key: ${apiKey || '<your-api-key>'}" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"username\\": \\"zeuscoineth_\\",
    \\"text\\": \\"Check out #PEPESDOG!\\",
    \\"imageUrl\\": \\"$IMAGE_URL\\"
  }"`}
                        </pre>
                        <p className="mt-2">
                          <strong>Supported formats:</strong> JPEG, PNG, GIF, WebP (max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Get Tweets Accordion */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg">
                  <button
                    onClick={() => setGetTweetsDocsOpen(!getTweetsDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-blue-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      Get User Tweets API
                    </span>
                    <svg
                      className={`w-5 h-5 text-blue-600 transition-transform ${getTweetsDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {getTweetsDocsOpen && (
                    <div className="p-4 border-t border-blue-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Retrieve the last X tweets from any connected user (includes both tweets and replies):
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/tweets?username=user_handle&count=20
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}

Response:
{
  "user": {
    "username": "user_handle",
    "userId": "123456789"
  },
  "stats": {
    "total_tweets": 20,
    "original_tweets": 15,    // Number of original tweets
    "replies": 5,              // Number of replies to other tweets
    "pepesdog_tweets": 5,
    "total_engagement": 1250,
    "average_engagement": 62
  },
  "tweets": [
    {
      "id": "1234567890",
      "text": "Tweet content here #PEPESDOG",
      "created_at": "2024-01-01T12:00:00Z",
      "type": "tweet",          // "tweet" for original tweets, "reply" for replies
      "is_reply": false,        // Boolean indicating if it's a reply
      "reply_to_id": null,      // ID of tweet being replied to (null if not a reply)
      "in_reply_to_user_id": null, // User ID being replied to
      "metrics": {
        "likes": 45,
        "retweets": 12,
        "replies": 5
      },
      "url": "https://twitter.com/user_handle/status/1234567890",
      "is_pepesdog": true
    },
    {
      "id": "1234567891",
      "text": "@other_user Great point! #PEPESDOG to the moon!",
      "created_at": "2024-01-01T13:00:00Z",
      "type": "reply",          // This is a reply to another tweet
      "is_reply": true,
      "reply_to_id": "1234567800", // ID of the original tweet
      "in_reply_to_user_id": "987654321", // User being replied to
      "metrics": {
        "likes": 10,
        "retweets": 2,
        "replies": 1
      },
      "url": "https://twitter.com/user_handle/status/1234567891",
      "is_pepesdog": true
    }
  ]
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Reply to Tweet Accordion */}
                <div className="bg-green-50 border border-green-200 rounded-lg">
                  <button
                    onClick={() => setReplyDocsOpen(!replyDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-green-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-green-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      Reply to Tweet API
                    </span>
                    <svg
                      className={`w-5 h-5 text-green-600 transition-transform ${replyDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {replyDocsOpen && (
                    <div className="p-4 border-t border-green-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Reply to any tweet using a Zeus Army member account:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/twitter/tweet/v2
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "username": "user_handle",
  "text": "This is the way! #PEPESDOG TO THE MOON!",
  "replyToTweetId": "1234567890123456"
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Get Zeus Army Members Accordion */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg">
                  <button
                    onClick={() => setGetMembersDocsOpen(!getMembersDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-indigo-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-indigo-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                      </svg>
                      Get Zeus Army Members API
                    </span>
                    <svg
                      className={`w-5 h-5 text-indigo-600 transition-transform ${getMembersDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {getMembersDocsOpen && (
                    <div className="p-4 border-t border-indigo-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Get all connected Zeus Army members:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/users
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}

Response:
[
  {
    "userId": "123456789",
    "username": "zeuscoineth_",
    "displayName": "Zeus Coin",
    "isActive": true,
    "connectedAt": "2024-01-01T00:00:00Z",
    "hasOAuth2": true,
    "scope": "tweet.read tweet.write users.read like.write"
  },
  {
    "userId": "987654321",
    "username": "pepesarmy",
    "displayName": "Pepe's Army",
    "isActive": true,
    "connectedAt": "2024-01-02T00:00:00Z",
    "hasOAuth2": false,
    "scope": null
  }
]`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Get Zeus Army Activity Summary Accordion */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg">
                  <button
                    onClick={() => setGetStatsDocsOpen(!getStatsDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-cyan-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-cyan-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                      </svg>
                      Get Zeus Army Activity Summary API
                    </span>
                    <svg
                      className={`w-5 h-5 text-cyan-600 transition-transform ${getStatsDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {getStatsDocsOpen && (
                    <div className="p-4 border-t border-cyan-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Get a summary of Zeus Army activity:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/hivemind/tweets
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "hours": 24
}

Response:
{
  "summary": {
    "total_members": 150,
    "time_period_hours": 24,
    "members": [
      {
        "username": "member1",
        "userId": "123",
        "connectedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Post Tweet with Video Accordion */}
                <div className="bg-pink-50 border border-pink-200 rounded-lg">
                  <button
                    onClick={() => setPostVideoDocsOpen(!postVideoDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-pink-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-pink-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                      </svg>
                      Post Tweet with Video API
                    </span>
                    <svg
                      className={`w-5 h-5 text-pink-600 transition-transform ${postVideoDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {postVideoDocsOpen && (
                    <div className="p-4 border-t border-pink-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Share videos through Zeus Army members:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/twitter/tweet/v2
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "username": "user_handle",
  "text": "Watch this epic #PEPESDOG moment!",
  "videoUrl": "https://example.com/epic-video.mp4"
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Retweet a Tweet Accordion */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg">
                  <button
                    onClick={() => setRetweetDocsOpen(!retweetDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-orange-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-orange-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                      </svg>
                      Retweet API
                    </span>
                    <svg
                      className={`w-5 h-5 text-orange-600 transition-transform ${retweetDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {retweetDocsOpen && (
                    <div className="p-4 border-t border-orange-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Retweet any tweet using Zeus Army members:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/twitter/retweet
Headers:
  Authorization: Bearer ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "tweetId": "1234567890123456789",
  "action": "retweet"  // or "unretweet" to undo
}

Response:
{
  "success": true,
  "action": "retweet",
  "tweetId": "1234567890123456789",
  "result": {
    "retweeted": true
  }
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Like a Tweet Accordion */}
                <div className="bg-red-50 border border-red-200 rounded-lg">
                  <button
                    onClick={() => setLikeDocsOpen(!likeDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-red-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-red-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                      </svg>
                      Like Tweet API
                    </span>
                    <svg
                      className={`w-5 h-5 text-red-600 transition-transform ${likeDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {likeDocsOpen && (
                    <div className="p-4 border-t border-red-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Like any tweet using Zeus Army members:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/twitter/like
Headers:
  Authorization: Bearer ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "tweetId": "1234567890123456789",
  "action": "like"  // or "unlike" to undo
}

Response:
{
  "success": true,
  "action": "like",
  "tweetId": "1234567890123456789",
  "result": {
    "liked": true
  }
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Check Rate Limits Accordion */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg">
                  <button
                    onClick={() => setCheckRateLimitsDocsOpen(!checkRateLimitsDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-teal-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-teal-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                      </svg>
                      Check Rate Limits API
                    </span>
                    <svg
                      className={`w-5 h-5 text-teal-600 transition-transform ${checkRateLimitsDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {checkRateLimitsDocsOpen && (
                    <div className="p-4 border-t border-teal-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Monitor Twitter API rate limits for Zeus Army operations:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/rate-limits
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}

// Optional: Get rate limits for specific user
GET https://hive.pepes.dog/api/hivemind/rate-limits?username=user_handle

Response:
{
  "rateLimits": [
    {
      "account": {
        "id": "1234567890",
        "username": "user_handle",
        "displayName": "User Name"
      },
      "endpoint": "POST /2/tweets",
      "endpointType": "tweet",
      "limit": 300,
      "remaining": 250,
      "used": 50,
      "percentageUsed": 17,
      "reset": "2024-02-23T10:00:00.000Z",
      "resetIn": 3600,
      "lastRequestAt": "2024-02-23T09:00:00.000Z"
    }
  ],
  "summary": {
    "totalUsers": 5,
    "activeEndpoints": 10,
    "mostUsedEndpoint": "POST /2/tweets",
    "nextReset": "2024-02-23T10:00:00.000Z"
  }
}`}
                      </pre>
                      <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded text-xs">
                        <p className="font-semibold text-amber-800 mb-1">⚠️ Important Note on Rate Limit Tracking:</p>
                        <ul className="text-amber-700 space-y-1 ml-2">
                          <li>• Rate limits for tweets (POST /2/tweets) are only captured when hitting 429 errors</li>
                          <li>• Twitter API v2 with OAuth 2.0 doesn't return rate limit headers on successful requests</li>
                          <li>• Like and retweet endpoints properly track rate limits on both success and errors</li>
                          <li>• To see tweet rate limits, you must hit the limit (429 error) at least once</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rate Limit Error Handling Accordion */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg">
                  <button
                    onClick={() => setRateLimitErrorDocsOpen(!rateLimitErrorDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-amber-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      Rate Limit Error Handling
                    </span>
                    <svg
                      className={`w-5 h-5 text-amber-600 transition-transform ${rateLimitErrorDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {rateLimitErrorDocsOpen && (
                    <div className="p-4 border-t border-amber-200">
                      <p className="text-sm text-gray-600 mb-3">
                        When rate limits are exceeded, you'll receive detailed error information:
                      </p>
                      <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`// 429 Rate Limit Error Response
{
  "error": "Rate limit exceeded. Too many requests.",
  "details": {
    "message": "Twitter API rate limit reached.",
    "resetAt": "2024-02-23T10:00:00.000Z",
    "limit": 50,
    "remaining": 0,
    "retryAfter": 900,  // seconds until reset
    "endpoint": "likes"
  }
}`}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Rate Limits Info Box */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg">
                  <button
                    onClick={() => setRateLimitsDocsOpen(!rateLimitsDocsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-yellow-100 transition-colors"
                  >
                    <span className="flex items-center font-medium text-yellow-900">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                      </svg>
                      Twitter API Rate Limits Reference
                    </span>
                    <svg
                      className={`w-5 h-5 text-yellow-600 transition-transform ${rateLimitsDocsOpen ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {rateLimitsDocsOpen && (
                    <div className="p-4 border-t border-yellow-200">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-2">Twitter API Rate Limits</h4>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        <li>• Post Tweet: 300 per 3 hours per user</li>
                        <li>• Retweet: 1000 per 24 hours per user</li>
                        <li>• Like: 1000 per 24 hours per user</li>
                        <li>• Get Tweets: 180 per 15 minutes</li>
                        <li>• Media Upload: 415 per 24 hours</li>
                        <li>• API Key: 1000 requests per hour</li>
                      </ul>
                      <div className="mt-3 pt-3 border-t border-yellow-300">
                        <h4 className="text-sm font-semibold text-yellow-800 mb-2">Important Notes</h4>
                        <ul className="text-xs text-yellow-700 space-y-1">
                          <li>• All endpoints accept X-API-Key header for authentication</li>
                          <li>• GET /api/hivemind/tweets returns both tweets and replies with type indicators</li>
                          <li>• GET /api/hivemind/users returns all connected Zeus Army members</li>
                          <li>• Retweet and Like endpoints work with OAuth 2.0 and OAuth 1.0a</li>
                          <li>• Tweets containing "pepesdog" get automatic engagement from Zeus Army</li>
                          <li>• Images/videos are included by passing URLs (imageUrl or videoUrl)</li>
                          <li>• Twitter automatically shows preview cards for media URLs</li>
                          <li>• URLs count as 23 characters in Twitter's character limit</li>
                          <li>• Users can disconnect anytime from their dashboard</li>
                          <li>• All credentials are encrypted with AES-256-GCM</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Hivemind Configuration</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twitter App for Hivemind
                </label>
                <select
                  value={selectedAppId || ''}
                  onChange={(e) => setSelectedAppId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Use Environment Variables (Default)</option>
                  {twitterApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Select which Twitter app credentials Hivemind users will authorize
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hivemind-enabled"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="hivemind-enabled" className="ml-2 text-sm text-gray-700">
                  Enable Hivemind feature
                </label>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Connected Users</h2>
          </div>
          <div className="overflow-x-auto">
            {hivemindUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No users connected to Hivemind yet
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connected At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hivemindUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.profileImageUrl && (
                            <img
                              className="h-8 w-8 rounded-full mr-3"
                              src={user.profileImageUrl}
                              alt=""
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.displayName}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.connectedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.lastActiveAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}