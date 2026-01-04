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

interface ForwardingEndpoint {
  id: string;
  projectId: string;
  name: string;
  url: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deliveries: number;
  };
}

function ProjectDetailContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Collapsible sections state
  const [webhookDocsOpen, setWebhookDocsOpen] = useState(false);
  const [apiKeyDocsOpen, setApiKeyDocsOpen] = useState(false);
  const [dmDocsOpen, setDmDocsOpen] = useState(false);
  const [webhooksInfoDocsOpen, setWebhooksInfoDocsOpen] = useState(false);
  const [userLookupDocsOpen, setUserLookupDocsOpen] = useState(false);
  const [isFollowingDocsOpen, setIsFollowingDocsOpen] = useState(false);

  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsNextCursor, setLogsNextCursor] = useState<string | null>(null);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Forwarding endpoints state
  const [endpoints, setEndpoints] = useState<ForwardingEndpoint[]>([]);
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [savingEndpoint, setSavingEndpoint] = useState(false);

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
      setMessage({
        type: 'success',
        text: '✅ Bot connected successfully! The bot is now subscribed to webhooks and will receive events from Twitter.'
      });
    } else if (error) {
      // Format error message based on error type
      let errorMessage = error;

      if (error.includes('Webhook registration failed')) {
        errorMessage = '❌ Bot connection failed: Unable to register webhook with Twitter. This is required for the bot to receive events (mentions, DMs, etc.). Please try connecting the bot again. If the problem persists, check the deployment logs for details.';
      } else if (error.includes('oauth_params_missing')) {
        errorMessage = '❌ OAuth parameters missing. Please start the bot connection process again.';
      } else if (error.includes('twitter_not_configured')) {
        errorMessage = '❌ Twitter API credentials are not configured. Please contact the administrator.';
      } else if (error.includes('twitter_user_fetch_failed')) {
        errorMessage = '❌ Failed to retrieve bot account information from Twitter. Please try again.';
      } else if (error.includes('project_not_found')) {
        errorMessage = '❌ Project not found. Please contact support.';
      } else {
        errorMessage = `❌ Error: ${decodeURIComponent(error)}`;
      }

      setMessage({ type: 'error', text: errorMessage });
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      fetchProject();
      fetchBotStatus();
      fetchApiKeyConfig();
      fetchWebhookLogs();
      fetchEndpoints();
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

  const fetchEndpoints = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/endpoints`);
      const data = await res.json();
      setEndpoints(data.endpoints || []);
    } catch (error) {
      console.error('Error fetching endpoints:', error);
    }
  };

  const addEndpoint = async () => {
    if (!newEndpointName.trim() || !newEndpointUrl.trim()) {
      setMessage({ type: 'error', text: 'Please provide both name and URL' });
      return;
    }

    setSavingEndpoint(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEndpointName,
          url: newEndpointUrl,
          enabled: true,
          priority: 0
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Endpoint added successfully' });
        setShowAddEndpoint(false);
        setNewEndpointName('');
        setNewEndpointUrl('');
        fetchEndpoints();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to add endpoint' });
      }
    } catch (error) {
      console.error('Error adding endpoint:', error);
      setMessage({ type: 'error', text: 'Error adding endpoint' });
    } finally {
      setSavingEndpoint(false);
    }
  };

  const toggleEndpoint = async (endpointId: string, currentlyEnabled: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/endpoints/${endpointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled })
      });

      if (res.ok) {
        setMessage({
          type: 'success',
          text: currentlyEnabled ? 'Endpoint paused' : 'Endpoint enabled'
        });
        fetchEndpoints();
      } else {
        setMessage({ type: 'error', text: 'Failed to update endpoint' });
      }
    } catch (error) {
      console.error('Error toggling endpoint:', error);
      setMessage({ type: 'error', text: 'Error updating endpoint' });
    }
  };

  const deleteEndpoint = async (endpointId: string, endpointName: string) => {
    if (!confirm(`Delete endpoint "${endpointName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/endpoints/${endpointId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Endpoint deleted successfully' });
        fetchEndpoints();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete endpoint' });
      }
    } catch (error) {
      console.error('Error deleting endpoint:', error);
      setMessage({ type: 'error', text: 'Error deleting endpoint' });
    }
  };

  const resumeEndpoint = async (endpointId: string, endpointName: string) => {
    if (!confirm(`Resume all paused webhooks for "${endpointName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/endpoints/${endpointId}/resume`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({
          type: 'success',
          text: `${data.resumedCount} webhook(s) resumed and processing started`
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to resume webhooks' });
      }
    } catch (error) {
      console.error('Error resuming webhooks:', error);
      setMessage({ type: 'error', text: 'Error resuming webhooks' });
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

        {/* Forwarding Endpoints Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Forwarding Endpoints</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure multiple endpoints to receive webhooks. Webhooks are delivered to all active endpoints.
              </p>
            </div>
            <button
              onClick={() => setShowAddEndpoint(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Endpoint
            </button>
          </div>

          {/* Endpoints List */}
          {endpoints.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <p className="text-yellow-800 font-medium">No endpoints configured</p>
              </div>
              <p className="text-yellow-700 text-sm mt-2">
                Add at least one endpoint to start receiving webhook events from Twitter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.id}
                  className={`border rounded-lg p-4 ${
                    endpoint.enabled
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          endpoint.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {endpoint.enabled ? '✓ Active' : '⏸ Paused'}
                        </span>
                        <h3 className="font-semibold text-gray-900">{endpoint.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 font-mono break-all">
                        {endpoint.url}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>
                          {endpoint._count?.deliveries || 0} webhooks delivered
                        </span>
                        <span>
                          Created: {new Date(endpoint.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => toggleEndpoint(endpoint.id, endpoint.enabled)}
                        className={`px-3 py-1 rounded text-sm font-medium transition ${
                          endpoint.enabled
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {endpoint.enabled ? 'Pause' : 'Enable'}
                      </button>
                      {!endpoint.enabled && (
                        <button
                          onClick={() => resumeEndpoint(endpoint.id, endpoint.name)}
                          className="px-3 py-1 rounded text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition"
                        >
                          Resume Webhooks
                        </button>
                      )}
                      <button
                        onClick={() => deleteEndpoint(endpoint.id, endpoint.name)}
                        className="px-3 py-1 rounded text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Endpoint Modal */}
          {showAddEndpoint && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Endpoint</h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="endpoint-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Endpoint Name
                    </label>
                    <input
                      id="endpoint-name"
                      type="text"
                      value={newEndpointName}
                      onChange={(e) => setNewEndpointName(e.target.value)}
                      placeholder="e.g., Primary Endpoint, Backup, Analytics"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="endpoint-url" className="block text-sm font-medium text-gray-700 mb-1">
                      Endpoint URL
                    </label>
                    <input
                      id="endpoint-url"
                      type="url"
                      value={newEndpointUrl}
                      onChange={(e) => setNewEndpointUrl(e.target.value)}
                      placeholder="https://your-app.com/webhooks/twitter"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={addEndpoint}
                      disabled={savingEndpoint}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                      {savingEndpoint ? 'Adding...' : 'Add Endpoint'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEndpoint(false);
                        setNewEndpointName('');
                        setNewEndpointUrl('');
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Forwarding Documentation - Collapsible */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <button
              onClick={() => setWebhookDocsOpen(!webhookDocsOpen)}
              className="w-full flex items-center justify-between text-sm font-semibold text-blue-900 hover:text-blue-700 transition"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                How Webhooks are Forwarded
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
                  <pre className="text-[10px]">{`POST https://your-endpoint.com/webhooks/twitter
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
  "replyToTweetId": "1234567890", // OPTIONAL - omit for normal tweet
  "imageUrl": "https://example.com/image.jpg", // OPTIONAL - image attachment
  "videoUrl": "https://example.com/video.mp4", // OPTIONAL - video attachment
  "idempotencyKey": "unique-key-123" // OPTIONAL - prevents duplicates on retry
}`}</pre>
                  </div>
                  <div className="mt-2 bg-purple-100 border border-purple-300 rounded p-2">
                    <p className="text-[10px] text-purple-800 mb-2">
                      <strong>Optional Parameters:</strong>
                    </p>
                    <ul className="text-[10px] text-purple-700 ml-4 space-y-1">
                      <li>• <strong>replyToTweetId:</strong> Tweet ID to reply to (omit for standalone tweet)</li>
                      <li>• <strong>imageUrl:</strong> URL of image to attach (PNG, JPG, GIF, WEBP)</li>
                      <li>• <strong>videoUrl:</strong> URL of video to attach (MP4)</li>
                      <li>• <strong>idempotencyKey:</strong> Unique key to prevent duplicate tweets on retry</li>
                    </ul>
                    <p className="text-[10px] text-purple-800 mt-2">
                      <strong>Note:</strong> Only one media type allowed per tweet (image OR video, not both)
                    </p>
                  </div>
                </div>

                {/* Example Request - Reply with Image */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example Request (Reply with Image)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet
Content-Type: application/json${apiKeyConfig?.configured ? '\nX-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') : ''}

{
  "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
  "text": "Check out this image! 🎨",
  "replyToTweetId": "1867517889123456789",
  "imageUrl": "https://example.com/image.jpg"
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

                {/* Example Request - Tweet with Video */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example Request (Tweet with Video)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet
Content-Type: application/json${apiKeyConfig?.configured ? '\nX-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') : ''}

{
  "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
  "text": "Amazing video! 🎥",
  "videoUrl": "https://example.com/video.mp4"
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
                  <p className="text-purple-800 font-semibold mb-2">Example with curl (with image)</p>
                  <div className="bg-gray-900 text-yellow-300 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/tweet \\
  -H "Content-Type: application/json" \\${apiKeyConfig?.configured ? '\n  -H "X-API-Key: ' + (apiKeyConfig.apiKey || 'your_api_key_here') + '" \\' : ''}
  -d '{
    "username": "${botStatus?.bot?.username || 'your_bot_handle'}",
    "text": "Hello from curl! 🎨",
    "imageUrl": "https://picsum.photos/800/600"
  }'`}</pre>
                  </div>
                </div>
                </div>
              )}
            </div>

            {/* DM API Documentation - Collapsible */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-4">
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

            {/* User Lookup API Documentation - Collapsible */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mt-4">
              <button
                onClick={() => setUserLookupDocsOpen(!userLookupDocsOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-teal-900 hover:text-teal-700 transition"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  User Lookup API Documentation
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${userLookupDocsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {userLookupDocsOpen && (
                <div className="mt-3 space-y-3 text-xs">
                {/* Endpoint URL */}
                <div>
                  <p className="text-teal-800 font-semibold mb-1">Endpoint</p>
                  <code className="bg-teal-100 text-teal-900 px-2 py-1 rounded block">
                    {process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/user
                  </code>
                </div>

                {/* HTTP Method */}
                <div>
                  <p className="text-teal-800 font-semibold mb-1">HTTP Method</p>
                  <code className="bg-teal-100 text-teal-900 px-2 py-1 rounded">GET</code>
                </div>

                {/* Description */}
                <div className="bg-teal-100 border border-teal-300 rounded p-2">
                  <p className="text-[10px] text-teal-800">
                    <strong>Purpose:</strong> Get detailed information about any Twitter user including followers, account age, verification status, and profile details.
                  </p>
                </div>

                {/* Headers */}
                <div>
                  <p className="text-teal-800 font-semibold mb-2">Headers</p>
                  <div className="bg-white rounded border border-teal-200 p-2 space-y-1 font-mono text-teal-900">
                    <div className="text-red-600 font-bold">X-API-Key: {apiKeyConfig?.apiKey || 'your_api_key_here'}</div>
                    <div className="text-teal-600 text-[10px]">// Your project API key is required</div>
                  </div>
                </div>

                {/* Query Parameters */}
                <div>
                  <p className="text-teal-800 font-semibold mb-2">Query Parameters</p>
                  <div className="bg-white rounded border border-teal-200 p-2 space-y-1 font-mono text-teal-900">
                    <div className="text-red-600 font-bold">handle (required)</div>
                    <div className="text-teal-600 text-[10px]">// Twitter username WITHOUT @ symbol (e.g., "elonmusk")</div>
                  </div>
                </div>

                {/* Example Request */}
                <div>
                  <p className="text-teal-800 font-semibold mb-2">Example Request</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`GET ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/user?handle=elonmusk
X-API-Key: ${apiKeyConfig?.apiKey || 'your_api_key_here'}`}</pre>
                  </div>
                </div>

                {/* Success Response */}
                <div>
                  <p className="text-teal-800 font-semibold mb-1">Success Response (200 OK)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "success": true,
  "user": {
    "id": "44196397",
    "username": "elonmusk",
    "name": "Elon Musk",
    "description": "Tesla, SpaceX, Neuralink, The Boring Company",
    "created_at": "2009-06-02T20:12:29.000Z",
    "account_age_days": 5680,
    "followers_count": 168500000,
    "following_count": 574,
    "tweet_count": 42300,
    "verified": true,
    "verified_type": "blue",
    "protected": false,
    "profile_image_url": "https://pbs.twimg.com/profile_images/...",
    "url": "https://twitter.com/elonmusk",
    "following": [
      {
        "id": "783214",
        "username": "twitter",
        "name": "Twitter",
        "description": "What's happening?!",
        "followers_count": 61500000,
        "following_count": 0,
        "tweet_count": 23400,
        "verified": true,
        "verified_type": "business",
        "profile_image_url": "https://pbs.twimg.com/profile_images/..."
      }
      // ... up to 100 users
    ],
    "total_following": 100,
    "following_next_token": "ABCD1234..." // null if no more results
  }
}`}</pre>
                  </div>
                  <div className="mt-2 bg-teal-100 border border-teal-300 rounded p-2">
                    <p className="text-[10px] text-teal-800 mb-2">
                      <strong>Response Fields:</strong>
                    </p>
                    <ul className="text-[10px] text-teal-700 ml-4 space-y-1">
                      <li>• <strong>id:</strong> Twitter user ID</li>
                      <li>• <strong>username:</strong> Twitter handle (without @)</li>
                      <li>• <strong>name:</strong> Display name</li>
                      <li>• <strong>description:</strong> User bio/description</li>
                      <li>• <strong>created_at:</strong> Account creation date (ISO 8601)</li>
                      <li>• <strong>account_age_days:</strong> Number of days since account creation</li>
                      <li>• <strong>followers_count:</strong> Number of followers</li>
                      <li>• <strong>following_count:</strong> Number of accounts following</li>
                      <li>• <strong>tweet_count:</strong> Total number of tweets</li>
                      <li>• <strong>verified:</strong> Whether account is verified</li>
                      <li>• <strong>verified_type:</strong> Type of verification (blue, business, government, null)</li>
                      <li>• <strong>protected:</strong> Whether tweets are protected (private)</li>
                      <li>• <strong>profile_image_url:</strong> Profile picture URL</li>
                      <li>• <strong>url:</strong> Full Twitter profile URL</li>
                      <li>• <strong>following:</strong> Array of users this user follows (max 100 per request)</li>
                      <li>• <strong>total_following:</strong> Number of users in the following array</li>
                      <li>• <strong>following_next_token:</strong> Token for pagination (null if no more results)</li>
                    </ul>
                  </div>
                </div>

                {/* Error Responses */}
                <div>
                  <p className="text-teal-800 font-semibold mb-2">Error Responses</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-teal-700 text-[10px] mb-1">401 Unauthorized - Missing or invalid API key:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "Invalid API key" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-teal-700 text-[10px] mb-1">404 Not Found - User not found:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "User not found: username" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-teal-700 text-[10px] mb-1">400 Bad Request - Missing handle:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "handle query parameter is required" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-teal-700 text-[10px] mb-1">400 Bad Request - Handle contains @:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "handle must be username only (without @ symbol)" }`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Example with curl */}
                <div>
                  <p className="text-teal-800 font-semibold mb-2">Example with curl</p>
                  <div className="bg-gray-900 text-yellow-300 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`curl -X GET "${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/user?handle=gotoalberto" \\
  -H "X-API-Key: ${apiKeyConfig?.apiKey || 'your_api_key_here'}"`}</pre>
                  </div>
                </div>

                {/* Use Cases */}
                <div className="bg-teal-100 border border-teal-300 rounded p-2">
                  <p className="text-[10px] text-teal-800 mb-2">
                    <strong>Common Use Cases:</strong>
                  </p>
                  <ul className="text-[10px] text-teal-700 ml-4 space-y-1">
                    <li>• Anti-spam validation (check account age before processing)</li>
                    <li>• User verification (check follower count, verified status)</li>
                    <li>• Profile information display in your application</li>
                    <li>• Account age requirements for certain features</li>
                    <li>• Bot detection (analyze follower/following ratio, tweet count)</li>
                    <li>• Social graph analysis (discover user's network and connections)</li>
                    <li>• Influencer relationship mapping (identify shared connections)</li>
                    <li>• Community discovery (find users with similar interests)</li>
                  </ul>
                </div>
                </div>
              )}
            </div>

            {/* Is Following API Documentation - Collapsible */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
              <button
                onClick={() => setIsFollowingDocsOpen(!isFollowingDocsOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-purple-900 hover:text-purple-700 transition"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  Is Following Check API Documentation
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${isFollowingDocsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {isFollowingDocsOpen && (
                <div className="mt-3 space-y-3 text-xs">
                {/* Endpoint URL */}
                <div>
                  <p className="text-purple-800 font-semibold mb-1">Endpoint</p>
                  <div className="bg-white rounded border border-purple-200 p-2 font-mono text-purple-900">
                    GET {process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/is-following
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Description</p>
                  <p className="text-purple-700">
                    Check if one Twitter user follows another user. This endpoint iterates through all users that userA follows to determine if userB is in that list. Handles pagination automatically.
                  </p>
                </div>

                {/* Query Parameters */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Query Parameters</p>
                  <div className="bg-white rounded border border-purple-200 p-2 space-y-2 font-mono text-purple-900">
                    <div>
                      <div className="text-red-600 font-bold">userA (required)</div>
                      <div className="text-purple-600 text-[10px]">// Twitter username to check (WITHOUT @ symbol, e.g., "gotoalberto")</div>
                    </div>
                    <div>
                      <div className="text-red-600 font-bold">userB (required)</div>
                      <div className="text-purple-600 text-[10px]">// Twitter username to check if followed by userA (WITHOUT @ symbol, e.g., "elonmusk")</div>
                    </div>
                  </div>
                </div>

                {/* Example Request */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example Request</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`GET ${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/is-following?userA=gotoalberto&userB=elonmusk
X-API-Key: ${apiKeyConfig?.apiKey || 'your_api_key_here'}`}</pre>
                  </div>
                </div>

                {/* Success Response */}
                <div>
                  <p className="text-purple-800 font-semibold mb-1">Success Response (200 OK)</p>
                  <div className="bg-gray-900 text-green-400 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`{
  "success": true,
  "userA": "gotoalberto",
  "userB": "elonmusk",
  "isFollowing": true,
  "meta": {
    "totalChecked": 250,
    "iterations": 1,
    "durationMs": 450
  }
}`}</pre>
                  </div>
                  <div className="mt-2 bg-purple-100 border border-purple-300 rounded p-2">
                    <p className="text-[10px] text-purple-800 mb-2">
                      <strong>Response Fields:</strong>
                    </p>
                    <ul className="text-[10px] text-purple-700 ml-4 space-y-1">
                      <li>• <strong>success:</strong> Boolean indicating if request succeeded</li>
                      <li>• <strong>userA:</strong> Twitter handle of user being checked</li>
                      <li>• <strong>userB:</strong> Twitter handle of potentially followed user</li>
                      <li>• <strong>isFollowing:</strong> Boolean - true if userA follows userB, false otherwise</li>
                      <li>• <strong>meta.totalChecked:</strong> Total number of users checked during search</li>
                      <li>• <strong>meta.iterations:</strong> Number of API calls made (pagination)</li>
                      <li>• <strong>meta.durationMs:</strong> Time taken to complete check in milliseconds</li>
                    </ul>
                  </div>
                </div>

                {/* Error Responses */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Error Responses</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">401 Unauthorized - Missing or invalid API key:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "Invalid API key" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">404 Not Found - User not found:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "User not found: username" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">400 Bad Request - Missing parameters:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "userA and userB query parameters are required" }`}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-purple-700 text-[10px] mb-1">400 Bad Request - Handle contains @:</p>
                      <div className="bg-gray-900 text-red-400 rounded p-2">
                        <pre className="text-[10px]">{`{ "error": "handles must be usernames only (without @ symbol)" }`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Example with curl */}
                <div>
                  <p className="text-purple-800 font-semibold mb-2">Example with curl</p>
                  <div className="bg-gray-900 text-yellow-300 rounded p-3 overflow-x-auto">
                    <pre className="text-[10px]">{`curl -X GET "${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/twitter/is-following?userA=gotoalberto&userB=elonmusk" \\
  -H "X-API-Key: ${apiKeyConfig?.apiKey || 'your_api_key_here'}"`}</pre>
                  </div>
                </div>

                {/* Use Cases */}
                <div className="bg-purple-100 border border-purple-300 rounded p-2">
                  <p className="text-[10px] text-purple-800 mb-2">
                    <strong>Common Use Cases:</strong>
                  </p>
                  <ul className="text-[10px] text-purple-700 ml-4 space-y-1">
                    <li>• Anti-spam validation (check if user follows legitimate accounts)</li>
                    <li>• Community verification (ensure users follow required accounts)</li>
                    <li>• Access control (gate features based on follow relationships)</li>
                    <li>• Relationship verification (confirm mutual connections)</li>
                    <li>• Influencer validation (check if user follows brand ambassadors)</li>
                    <li>• Trust scoring (build reputation based on who users follow)</li>
                  </ul>
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
