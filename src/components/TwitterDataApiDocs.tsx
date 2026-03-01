'use client';

import { useState } from 'react';

interface TwitterDataApiDocsProps {
  projectId: string;
  apiKey: string | null;
  baseUrl?: string;
}

export default function TwitterDataApiDocs({ projectId, apiKey, baseUrl = '' }: TwitterDataApiDocsProps) {
  const [searchDocsOpen, setSearchDocsOpen] = useState(false);
  const [userDocsOpen, setUserDocsOpen] = useState(false);
  const [tweetDocsOpen, setTweetDocsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Tweet Search API */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <button
          onClick={() => setSearchDocsOpen(!searchDocsOpen)}
          className="w-full flex items-center justify-between text-sm font-semibold text-blue-900 hover:text-blue-700 transition"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            Twitter Data API - Search & Analytics
          </span>
          <svg className={`w-5 h-5 transition-transform ${searchDocsOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {searchDocsOpen && (
          <div className="mt-4 space-y-3 text-xs">
            {/* Search Tweets */}
            <div className="bg-white border border-blue-100 rounded p-3">
              <h4 className="font-semibold text-blue-900 mb-2">🔍 Search Tweets</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`GET ${baseUrl}/api/projects/${projectId}/twitter/search

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Query Parameters:
  q: "bitcoin"               # Search query (required)
  count: 20                  # Results per page (max: 100)
  cursor: "next_cursor"      # Pagination cursor
  from: "elonmusk"          # From specific user
  to: "vitalikbuterin"      # To specific user
  lang: "en"                # Language filter
  filter: "verified"        # Additional filters

Response:
{
  "success": true,
  "data": {
    "tweets": [...],
    "next_cursor": "cursor_123",
    "has_more": true
  }
}`}
              </pre>
            </div>

            {/* Search Users */}
            <div className="bg-white border border-blue-100 rounded p-3">
              <h4 className="font-semibold text-blue-900 mb-2">👥 Search Users</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`GET ${baseUrl}/api/projects/${projectId}/twitter/users/search

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Query Parameters:
  q: "crypto"               # Search query (required)
  count: 20                 # Results per page
  cursor: "next_cursor"     # Pagination

Response:
{
  "success": true,
  "data": {
    "users": [...],
    "next_cursor": "cursor_456",
    "has_more": true
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* User Data API */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <button
          onClick={() => setUserDocsOpen(!userDocsOpen)}
          className="w-full flex items-center justify-between text-sm font-semibold text-green-900 hover:text-green-700 transition"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            User Profile & Network Data
          </span>
          <svg className={`w-5 h-5 transition-transform ${userDocsOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {userDocsOpen && (
          <div className="mt-4 space-y-3 text-xs">
            {/* Get User Profile */}
            <div className="bg-white border border-green-100 rounded p-3">
              <h4 className="font-semibold text-green-900 mb-2">👤 Get User Profile</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`GET ${baseUrl}/api/projects/${projectId}/twitter/users/elonmusk

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Response:
{
  "success": true,
  "data": {
    "id": "44196397",
    "username": "elonmusk",
    "name": "Elon Musk",
    "description": "...",
    "followers_count": 150000000,
    "following_count": 500,
    "tweet_count": 25000,
    "verified": true,
    "profile_image_url": "..."
  }
}`}
              </pre>
            </div>

            {/* Get User Tweets */}
            <div className="bg-white border border-green-100 rounded p-3">
              <h4 className="font-semibold text-green-900 mb-2">📝 Get User Tweets</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`GET ${baseUrl}/api/projects/${projectId}/twitter/users/elonmusk/tweets

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Query Parameters:
  count: 20                   # Number of tweets
  cursor: "next_cursor"       # Pagination
  exclude_replies: false      # Exclude replies
  include_rts: true          # Include retweets

Response:
{
  "success": true,
  "data": {
    "tweets": [...],
    "next_cursor": "cursor_789",
    "has_more": true
  }
}`}
              </pre>
            </div>

            {/* Get Followers/Following */}
            <div className="bg-white border border-green-100 rounded p-3">
              <h4 className="font-semibold text-green-900 mb-2">👥 Get Followers/Following</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`# Get Followers
GET ${baseUrl}/api/projects/${projectId}/twitter/users/elonmusk/followers

# Get Following
GET ${baseUrl}/api/projects/${projectId}/twitter/users/elonmusk/following

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Query Parameters:
  cursor: "next_cursor"    # Pagination (200 per page)

Response:
{
  "success": true,
  "data": {
    "users": [...],
    "next_cursor": "cursor_abc",
    "has_more": true
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Tweet Data API */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <button
          onClick={() => setTweetDocsOpen(!tweetDocsOpen)}
          className="w-full flex items-center justify-between text-sm font-semibold text-purple-900 hover:text-purple-700 transition"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd"/>
            </svg>
            Tweet Details & Engagement
          </span>
          <svg className={`w-5 h-5 transition-transform ${tweetDocsOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {tweetDocsOpen && (
          <div className="mt-4 space-y-3 text-xs">
            {/* Get Tweet by ID */}
            <div className="bg-white border border-purple-100 rounded p-3">
              <h4 className="font-semibold text-purple-900 mb-2">📱 Get Tweet Details</h4>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
{`GET ${baseUrl}/api/projects/${projectId}/twitter/tweets/1234567890

Headers:
  X-API-Key: ${apiKey || 'your-api-key'}

Query Parameters:
  include_replies: true     # Include reply tweets
  include_quotes: true      # Include quote tweets

Response:
{
  "success": true,
  "data": {
    "tweet": {
      "id": "1234567890",
      "text": "Tweet content...",
      "created_at": "2024-01-01T12:00:00Z",
      "author_id": "44196397",
      "public_metrics": {
        "retweet_count": 1000,
        "like_count": 5000,
        "reply_count": 200,
        "quote_count": 50
      }
    },
    "replies": { "tweets": [...] },
    "quotes": { "tweets": [...] }
  }
}`}
              </pre>
            </div>

            {/* API Features */}
            <div className="bg-purple-100 border border-purple-300 rounded p-2">
              <p className="text-purple-800 mb-2 font-semibold">🚀 API Features:</p>
              <ul className="text-purple-700 ml-4 space-y-1">
                <li>• Powered by TwitterAPI.io for fast response times</li>
                <li>• No Twitter API rate limits</li>
                <li>• Average response time: 700ms</li>
                <li>• Supports up to 200 QPS</li>
                <li>• Automatic pagination with cursors</li>
                <li>• Standardized response format</li>
              </ul>
            </div>

            {/* Pricing Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-yellow-800 mb-2 font-semibold">💰 Usage & Pricing:</p>
              <ul className="text-yellow-700 ml-4 space-y-1">
                <li>• Tweet data: $0.15 per 1,000 tweets</li>
                <li>• User profiles: $0.18 per 1,000 profiles</li>
                <li>• Follower data: $0.15 per 1,000 followers</li>
                <li>• Minimum charge: $0.00015 per request</li>
                <li>• No rate limits or quotas</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}