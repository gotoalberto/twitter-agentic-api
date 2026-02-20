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
  const [selectedAppId, setSelectedAppId] = useState<string>('');
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
        setSelectedAppId(config?.twitterAppId || '');
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

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">API Usage</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Use this API key to publish tweets through Hivemind users:
                </p>
                <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`POST /api/twitter/tweet/v2
Headers:
  X-API-Key: ${apiKey || '<your-api-key>'}
  Content-Type: application/json

Body:
{
  "username": "<hivemind-user-handle>",
  "text": "Tweet text",
  "replyToTweetId": "optional",
  "imageUrl": "optional",
  "videoUrl": "optional"
}`}
                </pre>
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
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
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