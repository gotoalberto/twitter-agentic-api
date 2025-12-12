'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

interface BotStatus {
  connected: boolean;
  bot: {
    userId: string;
    username: string;
    connectedAt: string;
  } | null;
}

interface ForwardingConfig {
  configured: boolean;
  config: {
    endpoint: string;
    enabled: boolean;
    updatedAt: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function ProjectDetailContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [forwardingConfig, setForwardingConfig] = useState<ForwardingConfig | null>(null);
  const [forwardingEndpoint, setForwardingEndpoint] = useState('');
  const [forwardingEnabled, setForwardingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingForwarding, setSavingForwarding] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    // Check for success/error messages in URL
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'bot_connected') {
      setMessage({ type: 'success', text: 'Bot connected successfully' });
    } else if (error) {
      setMessage({ type: 'error', text: `Error: ${error}` });
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      fetchProject();
      fetchBotStatus();
      fetchForwardingConfig();
    }
  }, [status, projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else {
        setMessage({ type: 'error', text: 'Project not found' });
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setMessage({ type: 'error', text: 'Failed to load project' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/bot/status`);
      const data = await res.json();
      setBotStatus(data);
    } catch (error) {
      console.error('Error fetching bot status:', error);
    }
  };

  const fetchForwardingConfig = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/forwarding`);
      const data = await res.json();
      setForwardingConfig(data);
      if (data.config) {
        setForwardingEndpoint(data.config.endpoint);
        setForwardingEnabled(data.config.enabled);
      }
    } catch (error) {
      console.error('Error fetching forwarding config:', error);
    }
  };

  const saveForwardingConfig = async () => {
    if (!forwardingEndpoint.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid endpoint URL' });
      return;
    }

    setSavingForwarding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/forwarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: forwardingEndpoint,
          enabled: forwardingEnabled,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Forwarding endpoint saved successfully' });
        fetchForwardingConfig();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Error saving endpoint' });
      }
    } catch (error) {
      console.error('Error saving forwarding config:', error);
      setMessage({ type: 'error', text: 'Error saving forwarding endpoint' });
    } finally {
      setSavingForwarding(false);
    }
  };

  const deleteForwardingConfig = async () => {
    if (!confirm('Are you sure you want to delete the forwarding endpoint?')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/forwarding`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Forwarding endpoint deleted successfully' });
        setForwardingEndpoint('');
        setForwardingEnabled(true);
        fetchForwardingConfig();
      } else {
        setMessage({ type: 'error', text: 'Error deleting endpoint' });
      }
    } catch (error) {
      console.error('Error deleting forwarding config:', error);
      setMessage({ type: 'error', text: 'Error deleting forwarding endpoint' });
    }
  };

  const connectBot = () => {
    window.location.href = `/api/projects/${projectId}/bot/authorize`;
  };

  const disconnectBot = async () => {
    if (!confirm('Are you sure you want to disconnect the bot?')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/bot/disconnect`, {
        method: 'POST',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Bot disconnected successfully' });
        fetchBotStatus();
      } else {
        setMessage({ type: 'error', text: 'Error disconnecting bot' });
      }
    } catch (error) {
      console.error('Error disconnecting bot:', error);
      setMessage({ type: 'error', text: 'Error disconnecting bot' });
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">Project Configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  @{(session?.user as any)?.twitterHandle}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-red-600 hover:text-red-700 font-medium transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex justify-between items-center">
              <p className="font-medium">{message.text}</p>
              <button
                onClick={() => setMessage(null)}
                className="text-sm hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Bot Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Twitter Bot</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              botStatus?.connected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {botStatus?.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {botStatus?.connected && botStatus.bot ? (
            <div className="space-y-4">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-green-800 font-medium">Bot configured and ready to receive webhooks</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Username</p>
                  <p className="text-lg font-mono text-gray-900">@{botStatus.bot.username}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">User ID</p>
                  <p className="text-lg font-mono text-gray-900">{botStatus.bot.userId}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Connected</p>
                  <p className="text-sm text-gray-900">{new Date(botStatus.bot.connectedAt).toLocaleString('en-US')}</p>
                </div>
              </div>

              <button
                onClick={disconnectBot}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
              >
                Disconnect Bot
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-yellow-800 font-medium">No bot connected</p>
                </div>
              </div>

              <p className="text-gray-600 text-sm">
                To start receiving mentions via webhooks, you need to connect a Twitter bot account using OAuth 1.0a.
              </p>

              <button
                onClick={connectBot}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Connect Bot
              </button>
            </div>
          )}
        </div>

        {/* Webhook Forwarding Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhook Forwarding</h2>

          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Configure an endpoint to automatically forward all Twitter webhooks.
              The payload will be sent exactly as received from Twitter.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 mb-2">
                  Forwarding Endpoint URL
                </label>
                <input
                  id="endpoint"
                  type="url"
                  value={forwardingEndpoint}
                  onChange={(e) => setForwardingEndpoint(e.target.value)}
                  placeholder="https://your-api.com/webhooks/twitter"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="enabled"
                  type="checkbox"
                  checked={forwardingEnabled}
                  onChange={(e) => setForwardingEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                  Enable forwarding
                </label>
              </div>

              {/* Webhook Forwarding Documentation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  Webhook Request Details
                </h3>

                <div className="space-y-3 text-xs">
                  {/* HTTP Method */}
                  <div>
                    <p className="text-blue-800 font-semibold mb-1">HTTP Method</p>
                    <code className="bg-blue-100 text-blue-900 px-2 py-1 rounded">POST</code>
                  </div>

                  {/* Headers */}
                  <div>
                    <p className="text-blue-800 font-semibold mb-2">Headers</p>
                    <div className="bg-white rounded border border-blue-200 p-2 space-y-1 font-mono text-blue-900">
                      <div>Content-Type: application/json</div>
                      <div>X-Twitter-Webhooks-Signature: sha256=...</div>
                      <div className="text-blue-600 text-[10px]">// Signature for payload verification (optional)</div>
                    </div>
                  </div>

                  {/* Body Format */}
                  <div>
                    <p className="text-blue-800 font-semibold mb-2">Body Format</p>
                    <p className="text-blue-700 mb-2">The webhook payload is forwarded as received from Twitter. Common event types:</p>
                    <div className="bg-white rounded border border-blue-200 p-2 space-y-1 text-[10px]">
                      <div className="text-blue-600">• <strong className="text-blue-900">tweet_create_events</strong> - New tweets mentioning the bot</div>
                      <div className="text-blue-600">• <strong className="text-blue-900">direct_message_events</strong> - Direct messages to the bot</div>
                      <div className="text-blue-600">• <strong className="text-blue-900">favorite_events</strong> - Likes on bot tweets</div>
                      <div className="text-blue-600">• <strong className="text-blue-900">follow_events</strong> - New followers</div>
                    </div>
                  </div>

                  {/* Example */}
                  <div>
                    <p className="text-blue-800 font-semibold mb-2">Example Request</p>
                    <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                      <pre className="text-[10px]">{`POST ${forwardingEndpoint || 'https://your-api.com/webhooks/twitter'}
Content-Type: application/json
X-Twitter-Webhooks-Signature: sha256=abc123...

{
  "for_user_id": "123456789",
  "tweet_create_events": [
    {
      "id_str": "987654321",
      "text": "@your_bot Hello!",
      "user": {
        "id_str": "111222333",
        "screen_name": "user_handle",
        "name": "User Name"
      },
      "created_at": "Mon Dec 12 12:00:00 +0000 2024",
      "entities": {
        "user_mentions": [
          {
            "screen_name": "your_bot",
            "id_str": "123456789"
          }
        ]
      }
    }
  ]
}`}</pre>
                    </div>
                  </div>

                  {/* Response Expected */}
                  <div>
                    <p className="text-blue-800 font-semibold mb-1">Expected Response</p>
                    <p className="text-blue-700 mb-2">Your endpoint should respond with:</p>
                    <div className="bg-gray-900 text-green-400 rounded p-2">
                      <pre className="text-[10px]">{`HTTP/1.1 200 OK
Content-Type: application/json

{ "success": true }`}</pre>
                    </div>
                    <p className="text-blue-600 mt-2">✓ Status 200-299 = Success (webhook will not retry)</p>
                    <p className="text-blue-600">✗ Other status = Error (may be retried)</p>
                  </div>
                </div>
              </div>

              {forwardingConfig?.configured && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Current configuration:</p>
                  <p className="text-xs font-mono text-gray-900 break-all">
                    {forwardingConfig.config?.endpoint}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Status: <span className={forwardingConfig.config?.enabled ? 'text-green-600' : 'text-gray-600'}>
                      {forwardingConfig.config?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated: {forwardingConfig.config?.updatedAt ? new Date(forwardingConfig.config.updatedAt).toLocaleString('en-US') : 'N/A'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveForwardingConfig}
                  disabled={savingForwarding}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  {savingForwarding ? 'Saving...' : 'Save Configuration'}
                </button>
                {forwardingConfig?.configured && (
                  <button
                    onClick={deleteForwardingConfig}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Webhooks Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhooks</h2>

          <div className="space-y-4">
            <p className="text-gray-600">
              Twitter webhooks will be processed automatically when the bot is connected.
              Bot mentions will be printed to server logs.
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex">
                <svg className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <div>
                  <p className="text-blue-800 font-medium mb-1">Webhook Information</p>
                  <p className="text-blue-700 text-sm">
                    To see mentions in real-time, check the server logs with:<br/>
                    <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono mt-2 inline-block">
                      npm run dev
                    </code>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Webhook endpoint:</p>
              <code className="text-xs font-mono text-gray-900 bg-white px-3 py-2 rounded border border-gray-200 block">
                {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/twitter
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <ProjectDetailContent />
    </Suspense>
  );
}
