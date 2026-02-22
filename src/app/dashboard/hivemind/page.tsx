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
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">API Usage Examples</h3>

                  {/* Post Tweet Example */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">1. Post a Tweet</h4>
                    <p className="text-sm text-gray-600 mb-2">
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
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}`}
                    </pre>
                  </div>

                  {/* Get User Tweets Example */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">2. Get Recent Tweets from a Zeus Army Member</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Retrieve the last X tweets from any connected user:
                    </p>
                    <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`GET https://hive.pepes.dog/api/hivemind/tweets?username=user_handle&count=20
Headers:
  Authorization: Bearer <session-token>

Response:
{
  "user": {
    "username": "user_handle",
    "userId": "123456789"
  },
  "stats": {
    "total_tweets": 20,
    "pepesdog_tweets": 5,
    "total_engagement": 1250,
    "average_engagement": 62
  },
  "tweets": [
    {
      "id": "1234567890",
      "text": "Tweet content here #PEPESDOG",
      "created_at": "2024-01-01T12:00:00Z",
      "metrics": {
        "likes": 45,
        "retweets": 12,
        "replies": 5
      },
      "is_pepesdog": true
    }
  ]
}`}
                    </pre>
                  </div>

                  {/* Reply to Tweet Example */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">3. Reply to a Tweet</h4>
                    <p className="text-sm text-gray-600 mb-2">
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

                  {/* Get All Members Activity */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">4. Get Zeus Army Members List</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Get a summary of all Zeus Army members:
                    </p>
                    <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST https://hive.pepes.dog/api/hivemind/tweets
Headers:
  Authorization: Bearer <session-token>
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

                  {/* Post with Video Example */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">5. Post Tweet with Video</h4>
                    <p className="text-sm text-gray-600 mb-2">
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
  "videoData": "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA..."
}`}
                    </pre>
                  </div>

                  {/* Rate Limits */}
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-1">Rate Limits</h4>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      <li>• Post Tweet: 300 per 3 hours per user</li>
                      <li>• Get Tweets: 180 per 15 minutes</li>
                      <li>• Media Upload: 415 per 24 hours</li>
                      <li>• API Key: 1000 requests per hour</li>
                    </ul>
                  </div>

                  {/* Important Notes */}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-800 mb-1">Important Notes</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Only admin accounts can access the GET endpoints</li>
                      <li>• Tweets containing "pepesdog" get automatic engagement from Zeus Army</li>
                      <li>• Images/videos must be sent as base64-encoded data (data:mime/type;base64,... format)</li>
                      <li>• Maximum file sizes: Images 5MB, Videos 15MB</li>
                      <li>• Users can disconnect anytime from their dashboard</li>
                      <li>• All credentials are encrypted with AES-256-GCM</li>
                    </ul>
                  </div>
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