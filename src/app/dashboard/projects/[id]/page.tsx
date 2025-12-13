'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';

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

interface ApiKeyConfig {
  configured: boolean;
  apiKey: string | null;
}

interface WebhookLog {
  id: string;
  eventType: string;
  forwardedTo: string;
  status: string;
  statusCode: number | null;
  payload: any;
  responseBody: any | null;
  createdAt: string;
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
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingForwarding, setSavingForwarding] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Collapsible sections state
  const [webhookDocsOpen, setWebhookDocsOpen] = useState(false);
  const [apiKeyDocsOpen, setApiKeyDocsOpen] = useState(false);
  const [dmDocsOpen, setDmDocsOpen] = useState(false);
  const [webhooksInfoDocsOpen, setWebhooksInfoDocsOpen] = useState(false);

  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsNextCursor, setLogsNextCursor] = useState<string | null>(null);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Ref for infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
      fetchApiKeyConfig();
      fetchWebhookLogs();
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

  const fetchApiKeyConfig = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/api-key`);
      const data = await res.json();
      setApiKeyConfig(data);
    } catch (error) {
      console.error('Error fetching API key config:', error);
    }
  };

  const generateApiKey = async () => {
    if (apiKeyConfig?.configured) {
      if (!confirm('This will replace your existing API key. Applications using the old key will stop working. Continue?')) {
        return;
      }
    }

    setGeneratingApiKey(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/api-key`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: 'API key generated successfully. Copy it now - it will not be shown again!' });
        fetchApiKeyConfig();
      } else {
        setMessage({ type: 'error', text: 'Error generating API key' });
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      setMessage({ type: 'error', text: 'Error generating API key' });
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const deleteApiKey = async () => {
    if (!confirm('Remove API key protection? The tweet endpoint will become public.')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/api-key`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'API key removed. Endpoint is now public.' });
        fetchApiKeyConfig();
      } else {
        setMessage({ type: 'error', text: 'Error removing API key' });
      }
    } catch (error) {
      console.error('Error removing API key:', error);
      setMessage({ type: 'error', text: 'Error removing API key' });
    }
  };

  const fetchWebhookLogs = async (cursor?: string) => {
    setLogsLoading(true);
    try {
      const url = cursor
        ? `/api/projects/${projectId}/webhook-logs?cursor=${cursor}`
        : `/api/projects/${projectId}/webhook-logs`;

      const res = await fetch(url);
      const data = await res.json();

      if (cursor) {
        // Append to existing logs (infinite scroll)
        setWebhookLogs((prev) => [...prev, ...data.logs]);
      } else {
        // Initial load
        setWebhookLogs(data.logs);
      }

      setLogsNextCursor(data.nextCursor);
      setLogsHasMore(data.hasMore);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadMoreLogs = () => {
    if (logsNextCursor && logsHasMore && !logsLoading) {
      fetchWebhookLogs(logsNextCursor);
    }
  };

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && logsHasMore && !logsLoading) {
          loadMoreLogs();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [logsHasMore, logsLoading, logsNextCursor]);

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

              {/* Action Buttons */}
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

              {forwardingConfig?.configured && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-mono text-gray-900 break-all">
                    {forwardingConfig.config?.endpoint}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Updated: {forwardingConfig.config?.updatedAt ? new Date(forwardingConfig.config.updatedAt).toLocaleString('en-US') : 'N/A'}
                  </p>
                </div>
              )}

              {/* Webhook Forwarding Documentation - Collapsible */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
                <button
                  onClick={() => setWebhookDocsOpen(!webhookDocsOpen)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-blue-900 hover:text-blue-700 transition"
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                    Webhook Request Details
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${webhookDocsOpen ? 'rotate-180' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {webhookDocsOpen && (
                  <div className="mt-3 space-y-3 text-xs">
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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* API Key Configuration Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Key Authentication</h2>

          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Protect your tweet publishing endpoint with an API key. When configured, all requests must include a valid X-API-Key header.
            </p>

            {/* API Key Status */}
            {apiKeyConfig && (
              <div className={`border-l-4 p-4 rounded ${
                apiKeyConfig.configured
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center">
                  <svg className={`w-5 h-5 mr-2 ${
                    apiKeyConfig.configured ? 'text-green-500' : 'text-yellow-500'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    {apiKeyConfig.configured ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    ) : (
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    )}
                  </svg>
                  <p className={`font-medium ${
                    apiKeyConfig.configured ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {apiKeyConfig.configured
                      ? 'API Key protection is enabled'
                      : 'No API key configured - endpoint is public'}
                  </p>
                </div>
              </div>
            )}

            {/* Show API Key if configured */}
            {apiKeyConfig?.configured && apiKeyConfig.apiKey && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Current API Key</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(apiKeyConfig.apiKey || '');
                      setMessage({ type: 'success', text: 'API key copied to clipboard' });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Copy
                  </button>
                </div>
                <code className="text-xs font-mono text-gray-900 bg-white px-3 py-2 rounded border border-gray-300 block break-all">
                  {apiKeyConfig.apiKey}
                </code>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={generateApiKey}
                disabled={generatingApiKey}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                {generatingApiKey
                  ? 'Generating...'
                  : apiKeyConfig?.configured
                    ? 'Regenerate API Key'
                    : 'Generate API Key'}
              </button>
              {apiKeyConfig?.configured && (
                <button
                  onClick={deleteApiKey}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Tweet Publishing Endpoint Documentation - Collapsible */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
              <button
                onClick={() => setApiKeyDocsOpen(!apiKeyDocsOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-purple-900 hover:text-purple-700 transition"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  Tweet Publishing API Documentation
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${apiKeyDocsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {apiKeyDocsOpen && (
                <div className="mt-3 space-y-3 text-xs">
                {/* Endpoint URL */}
                <div>
                  <p className="text-purple-800 font-semibold mb-1">Endpoint</p>
                  <code className="bg-purple-100 text-purple-900 px-2 py-1 rounded block">
                    {process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet
                  </code>
                </div>

                {/* HTTP Method */}
                <div>
                  <p className="text-purple-800 font-semibold mb-1">HTTP Method</p>
                  <code className="bg-purple-100 text-purple-900 px-2 py-1 rounded">POST</code>
                </div>

                {/* Headers */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Headers</p>
                  <div className="bg-white rounded border border-purple-200 p-2 space-y-1 font-mono text-purple-900">
                    <div>Content-Type: application/json</div>
                    {apiKeyConfig?.configured && (
                      <div className="text-red-600 font-bold">X-API-Key: {apiKeyConfig.apiKey ? 'your_api_key_here' : 'REQUIRED'}</div>
                    )}
                    {!apiKeyConfig?.configured && (
                      <div className="text-purple-600 text-[10px]">// No API key required (endpoint is public)</div>
                    )}
                  </div>
                </div>

                {/* Request Body */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Request Body</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "username": "your_bot_handle",
  "text": "Your tweet text here (max 280 chars)",
  "replyToTweetId": "1234567890" // OPTIONAL - omit for normal tweet
}`}</pre>
                  </div>
                  <div className="mt-2 bg-purple-100 border border-purple-300 rounded p-2">
                    <p className="text-[10px] text-purple-800">
                      <strong>Note:</strong> The <code className="bg-purple-200 px-1 rounded">replyToTweetId</code> parameter is <strong>optional</strong>:
                    </p>
                    <ul className="text-[10px] text-purple-700 ml-4 mt-1 space-y-1">
                      <li>• <strong>With replyToTweetId:</strong> Tweet will be posted as a reply to the specified tweet</li>
                      <li>• <strong>Without replyToTweetId:</strong> Tweet will be posted as a normal standalone tweet</li>
                    </ul>
                  </div>
                </div>

                {/* Example Request - Reply */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example Request (Reply to Tweet)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet
Content-Type: application/json${apiKeyConfig?.configured ? '\nX-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') : ''}

{
  "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
  "text": "Hello from the X Forwarder API!",
  "replyToTweetId": "1867517889123456789"
}`}</pre>
                  </div>
                </div>

                {/* Example Request - Normal Tweet */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example Request (Normal Tweet)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet
Content-Type: application/json${apiKeyConfig?.configured ? '\nX-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') : ''}

{
  "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
  "text": "Hello from the X Forwarder API!"
}`}</pre>
                  </div>
                </div>

                {/* Success Response */}
                <div>
                  <p className="text-purple-800 font-semibold mb-1">Success Response (200 OK)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "success": true,
  "tweet": {
    "id": "1867517889123456789",
    "text": "Hello from the X Forwarder API!",
    "url": "https://twitter.com/your_bot/status/1867517889123456789"
  }
}`}</pre>
                  </div>
                </div>

                {/* Error Responses */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Error Responses</p>
                  <div className="space-y-2">
                    {apiKeyConfig?.configured && (
                      <div>
                        <p className="text-purple-700 text-[10px] mb-1">401 Unauthorized - Missing or invalid API key:</p>
                        <div className="bg-gray-900 text-red-400 rounded p-2">
                          <pre className="text-[10px]">{`{ "error": "Invalid API key" }`}</pre>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">404 Not Found - Bot not found:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "No bot found with username: xyz" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">400 Bad Request - Invalid input:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "text must be 280 characters or less" }`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Example with curl */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example with curl</p>
                  <div className="bg-gray-900 text-yellow-300 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet \\
  -H "Content-Type: application/json" \\${apiKeyConfig?.configured ? '\n  -H "X-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') + '" \\' : ''}
  -d '{
    "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
    "text": "Hello from curl!"
  }'`}</pre>
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Direct Messages API Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Direct Messages API</h2>

          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Send direct messages on behalf of your bot. Same API key authentication as tweet endpoint.
            </p>

            {/* DM API Documentation - Collapsible */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <button
                onClick={() => setDmDocsOpen(!dmDocsOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-indigo-900 hover:text-indigo-700 transition"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  Direct Message API Documentation
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${dmDocsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {dmDocsOpen && (
                <div className="mt-3 space-y-3 text-xs">
                {/* Endpoint URL */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-1">Endpoint</p>
                  <code className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded block">
                    {process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/dm
                  </code>
                </div>

                {/* HTTP Method */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-1">HTTP Method</p>
                  <code className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded">POST</code>
                </div>

                {/* Headers */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-2">Headers</p>
                  <div className="bg-white rounded border border-indigo-200 p-2 space-y-1 font-mono text-indigo-900">
                    <div>Content-Type: application/json</div>
                    {apiKeyConfig?.configured && (
                      <div className="text-red-600 font-bold">X-API-Key: {apiKeyConfig.apiKey ? 'your_api_key_here' : 'REQUIRED'}</div>
                    )}
                    {!apiKeyConfig?.configured && (
                      <div className="text-indigo-600 text-[10px]">// No API key required (endpoint is public)</div>
                    )}
                  </div>
                </div>

                {/* Request Body */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-2">Request Body</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "username": "your_bot_handle",
  "recipientId": "1234567890",  // Twitter user ID
  "text": "Your message text (max 10000 chars)"
}`}</pre>
                  </div>
                  <div className="mt-2 bg-indigo-100 border border-indigo-300 rounded p-2">
                    <p className="text-[10px] text-indigo-800">
                      <strong>Note:</strong> The recipient must allow DMs from your bot.
                    </p>
                  </div>
                </div>

                {/* Example Request */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-2">Example Request</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/dm
Content-Type: application/json${apiKeyConfig?.configured ? '\nX-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') : ''}

{
  "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
  "recipientId": "1234567890",
  "text": "Hello! This is a DM from the bot."
}`}</pre>
                  </div>
                </div>

                {/* Success Response */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-1">Success Response (200 OK)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "success": true,
  "dm": {
    "id": "1867517889123456789",
    "text": "Hello! This is a DM from the bot.",
    "recipientId": "1234567890"
  }
}`}</pre>
                  </div>
                </div>

                {/* Error Responses */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-2">Error Responses</p>
                  <div className="space-y-2">
                    {apiKeyConfig?.configured && (
                      <div>
                        <p className="text-indigo-700 text-[10px] mb-1">401 Unauthorized - Missing or invalid API key:</p>
                        <div className="bg-gray-900 text-red-400 rounded p-2">
                          <pre className="text-[10px]">{`{ "error": "Invalid API key" }`}</pre>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-indigo-700 text-[10px] mb-1">403 Forbidden - Recipient doesn't allow DMs:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "Forbidden - check bot permissions or if recipient allows DMs" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-indigo-700 text-[10px] mb-1">404 Not Found - Bot not found:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "No bot found with username: xyz" }`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Example with curl */}
                <div>
                  <p className="text-indigo-800 font-semibold mb-2">Example with curl</p>
                  <div className="bg-gray-900 text-yellow-300 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/dm \\
  -H "Content-Type: application/json" \\${apiKeyConfig?.configured ? '\n  -H "X-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') + '" \\' : ''}
  -d '{
    "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
    "recipientId": "1234567890",
    "text": "Hello from curl!"
  }'`}</pre>
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Webhooks Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhooks</h2>

          <div className="space-y-4">
            <p className="text-gray-600">
              Twitter webhooks will be processed automatically when the bot is connected.
              Webhooks are forwarded to the configured endpoint (if any).
            </p>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">This API receives webhooks at:</p>
              <code className="text-xs font-mono text-gray-900 bg-white px-3 py-2 rounded border border-gray-200 block">
                {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/twitter
              </code>
            </div>

            {forwardingConfig?.configured && forwardingConfig.config?.endpoint && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">✓ Forwarding Enabled</p>
                <p className="text-xs text-green-700">
                  Webhooks are being forwarded to: <strong>{forwardingConfig.config.endpoint}</strong>
                </p>
              </div>
            )}

            {/* Webhook Forwarding Details - Collapsible */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <button
                onClick={() => setWebhooksInfoDocsOpen(!webhooksInfoDocsOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-blue-900 hover:text-blue-700 transition"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  How Webhooks are Forwarded
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${webhooksInfoDocsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {webhooksInfoDocsOpen && (
                <div className="mt-3">
                  <p className="text-blue-700 text-xs mb-3">
                    When a webhook is received from Twitter, it is <strong>automatically forwarded</strong> to your configured endpoint with the following details:
                  </p>

                  <div className="space-y-3 text-xs">
                {/* HTTP Method */}
                <div>
                  <p className="text-blue-800 font-semibold mb-1">HTTP Method</p>
                  <code className="bg-blue-100 text-blue-900 px-2 py-1 rounded">POST</code>
                </div>

                {/* Headers */}
                <div>
                  <p className="text-blue-800 font-semibold mb-2">Headers Sent</p>
                  <div className="bg-white rounded border border-blue-200 p-2 space-y-1 font-mono text-blue-900">
                    <div>Content-Type: application/json</div>
                    <div>X-Twitter-Webhooks-Signature: sha256=...</div>
                    <div className="text-blue-600 text-[10px]">// Original Twitter signature (can be used to verify payload authenticity)</div>
                  </div>
                </div>

                {/* Payload */}
                <div>
                  <p className="text-blue-800 font-semibold mb-2">Payload</p>
                  <p className="text-blue-700 mb-2">
                    The webhook payload is forwarded <strong>exactly as received</strong> from Twitter. No modifications are made.
                  </p>
                  <p className="text-blue-700 mb-2">Common event types you may receive:</p>
                  <div className="bg-white rounded border border-blue-200 p-2 space-y-1 text-[10px]">
                    <div className="text-blue-600">• <strong className="text-blue-900">tweet_create_events</strong> - New tweets (mentions, replies)</div>
                    <div className="text-blue-600">• <strong className="text-blue-900">direct_message_events</strong> - Direct messages</div>
                    <div className="text-blue-600">• <strong className="text-blue-900">favorite_events</strong> - Likes on tweets</div>
                    <div className="text-blue-600">• <strong className="text-blue-900">follow_events</strong> - New followers</div>
                  </div>
                </div>

                {/* Example Forwarded Request */}
                <div>
                  <p className="text-blue-800 font-semibold mb-2">Example Forwarded Request</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${forwardingConfig?.config?.endpoint || 'https://your-endpoint.com/api/webhooks/twitter'}
Content-Type: application/json
X-Twitter-Webhooks-Signature: sha256=abc123...

{
  "for_user_id": "123456789",
  "tweet_create_events": [
    {
      "id_str": "987654321",
      "text": "@${botStatus?.bot?.username || 'your_bot'} Hello!",
      "user": {
        "id_str": "111222333",
        "screen_name": "user_handle",
        "name": "User Name"
      },
      "created_at": "Thu Dec 12 12:00:00 +0000 2024",
      "entities": {
        "user_mentions": [
          {
            "screen_name": "${botStatus?.bot?.username || 'your_bot'}",
            "id_str": "123456789"
          }
        ]
      }
    }
  ]
}`}</pre>
                  </div>
                </div>

                {/* Expected Response */}
                <div>
                  <p className="text-blue-800 font-semibold mb-1">Expected Response from Your Endpoint</p>
                  <p className="text-blue-700 mb-2">Your endpoint should respond with:</p>
                  <div className="bg-gray-900 text-green-400 rounded p-2">
                    <pre className="text-[10px]">{`HTTP/1.1 200 OK
Content-Type: application/json

{ "success": true }`}</pre>
                  </div>
                  <p className="text-blue-600 mt-2">✓ Any 2xx status code = Success (webhook marked as delivered)</p>
                  <p className="text-blue-600">✗ Other status codes = Error (logged for debugging)</p>
                </div>

                {/* Additional Info */}
                <div className="bg-blue-100 border border-blue-300 rounded p-2 mt-2">
                  <p className="text-blue-800 font-semibold text-[10px] mb-1">Additional Information</p>
                  <ul className="text-blue-700 text-[10px] space-y-1">
                    <li>• The forwarding happens asynchronously - Twitter receives immediate 200 OK</li>
                    <li>• If forwarding fails, the error is logged but Twitter is not notified</li>
                    <li>• The X-Twitter-Webhooks-Signature can be verified using your Twitter consumer secret</li>
                    <li>• Full Twitter webhook documentation: <a href="https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/account-activity-data-objects" target="_blank" rel="noopener noreferrer" className="underline">Account Activity API</a></li>
                  </ul>
                </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Webhook Logs Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhook Logs</h2>

          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              All webhooks are delivered immediately when received. Failed deliveries are automatically retried every 2 minutes.
            </p>

            {webhookLogs.length === 0 && !logsLoading && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-500 text-sm">No webhook logs yet</p>
                <p className="text-gray-400 text-xs mt-2">
                  Logs will appear here when webhooks are forwarded to your endpoint
                </p>
              </div>
            )}

            {webhookLogs.length > 0 && (
              <div className="space-y-3">
                {webhookLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.status === 'delivered'
                                ? 'bg-green-100 text-green-800'
                                : log.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status === 'delivered' ? '✓' : log.status === 'pending' ? '⏳' : '✗'} {log.status.toUpperCase()}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {log.eventType}
                          </span>
                          {log.statusCode && (
                            <span className="text-xs text-gray-500">
                              HTTP {log.statusCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {new Date(log.createdAt).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'medium',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-xs">
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                        <span className="text-gray-600 font-medium">Forwarded to:</span>
                      </div>
                      <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 block break-all">
                        {log.forwardedTo}
                      </code>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 font-medium">
                        View payload
                      </summary>
                      <div className="mt-2 bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                        <pre className="text-[10px]">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    </details>

                    {log.responseBody && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 font-medium">
                          View endpoint response
                        </summary>
                        <div className="mt-2 bg-gray-900 text-blue-400 rounded p-3 overflow-x-auto">
                          <pre className="text-[10px]">
                            {JSON.stringify(log.responseBody, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                ))}

                {/* Infinite scroll trigger */}
                {logsHasMore && (
                  <div
                    ref={loadMoreRef}
                    className="flex items-center justify-center py-4"
                  >
                    {logsLoading && (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <span>Loading more...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {logsLoading && webhookLogs.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
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
