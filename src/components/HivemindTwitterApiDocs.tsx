'use client';

import { useState } from 'react';

interface HivemindTwitterApiDocsProps {
  apiKey: string | null;
}

export default function HivemindTwitterApiDocs({ apiKey }: HivemindTwitterApiDocsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4">
        <h3 className="text-lg font-bold mb-2">🐦 Twitter Data API</h3>
        <p className="text-sm opacity-90">
          Access comprehensive Twitter data including search, user profiles, tweets, and network analysis.
          Powered by TwitterAPI.io for blazing-fast responses without rate limits.
        </p>
      </div>

      {/* Search Endpoints */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('search')}
          className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
        >
          <span className="font-semibold text-blue-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            Search APIs
          </span>
          <svg className={`w-5 h-5 transition-transform ${expandedSection === 'search' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {expandedSection === 'search' && (
          <div className="p-4 space-y-4">
            {/* Search Tweets */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Search Tweets</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/twitter/search

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Query Parameters:
  q: "bitcoin OR ethereum"     # Search query (required)
  count: 50                    # Results (max: 100)
  cursor: "next_page"          # Pagination
  from: "vitalikbuterin"       # From user
  to: "elonmusk"              # To user
  lang: "en"                   # Language
  filter: "verified"           # Filters

curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/search?q=bitcoin&count=20" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"`}
              </pre>
            </div>

            {/* Search Users */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Search Users</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/twitter/users/search

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Query Parameters:
  q: "crypto influencer"       # Search query (required)
  count: 20                    # Results per page
  cursor: "pagination_token"   # For pagination

curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/users/search?q=crypto" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* User Endpoints */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('users')}
          className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors flex items-center justify-between"
        >
          <span className="font-semibold text-green-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            User Profile APIs
          </span>
          <svg className={`w-5 h-5 transition-transform ${expandedSection === 'users' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {expandedSection === 'users' && (
          <div className="p-4 space-y-4">
            {/* User Profile */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Get User Profile</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/twitter/users/{username}

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Example:
curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/users/elonmusk" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"`}
              </pre>
            </div>

            {/* User Tweets */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Get User Tweets</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/twitter/users/{username}/tweets

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Query Parameters:
  count: 20                  # Number of tweets
  cursor: "next"            # Pagination
  exclude_replies: true     # Exclude replies
  include_rts: false        # Include retweets

curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/users/elonmusk/tweets?count=10" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"`}
              </pre>
            </div>

            {/* Followers & Following */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Get Followers/Following</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`# Get Followers (200 per page)
GET https://hive.pepes.dog/api/hivemind/twitter/users/{username}/followers

# Get Following (200 per page)
GET https://hive.pepes.dog/api/hivemind/twitter/users/{username}/following

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Query Parameters:
  cursor: "pagination_token"   # For pagination

curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/users/elonmusk/followers" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Tweet Endpoints */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('tweets')}
          className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between"
        >
          <span className="font-semibold text-purple-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd"/>
            </svg>
            Tweet Analytics APIs
          </span>
          <svg className={`w-5 h-5 transition-transform ${expandedSection === 'tweets' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {expandedSection === 'tweets' && (
          <div className="p-4 space-y-4">
            {/* Get Tweet */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Get Tweet Details</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/twitter/tweets/{tweetId}

Headers:
  X-API-Key: ${apiKey || '<your-hivemind-api-key>'}

Query Parameters:
  include_replies: true      # Include replies
  include_quotes: true       # Include quotes

curl -X GET \\
  "https://hive.pepes.dog/api/hivemind/twitter/tweets/1234567890?include_replies=true" \\
  -H "X-API-Key: ${apiKey || '<your-key>'}"

Response includes:
- Tweet content and metrics
- Author information
- Engagement stats (likes, retweets, replies)
- Optional: Reply threads
- Optional: Quote tweets`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Features & Benefits */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <h4 className="font-semibold text-indigo-900 mb-3">✨ Key Features & Benefits</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-medium text-gray-800">No Rate Limits</p>
              <p className="text-xs text-gray-600">Up to 200 requests per second</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-medium text-gray-800">Fast Response</p>
              <p className="text-xs text-gray-600">Average 700ms response time</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-medium text-gray-800">Cost Effective</p>
              <p className="text-xs text-gray-600">Pay per use, no monthly fees</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-medium text-gray-800">Always Available</p>
              <p className="text-xs text-gray-600">No Twitter API downtime</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}