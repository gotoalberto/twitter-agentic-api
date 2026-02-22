'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TwitterApp {
  id: string;
  name: string;
  webhookEnv: string;
  webhookId?: string | null;
  webhookUrl?: string | null;
  webhookValid?: boolean;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

interface AppFormData {
  name: string;
  consumerKey: string;
  consumerSecret: string;
  clientId: string;
  clientSecret: string;
  bearerToken: string;
  webhookEnv: string;
  registerWebhook: boolean;
}

const emptyForm: AppFormData = {
  name: '',
  consumerKey: '',
  consumerSecret: '',
  clientId: '',
  clientSecret: '',
  bearerToken: '',
  webhookEnv: 'production',
  registerWebhook: true, // Default to true for convenience
};

export default function AppsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [apps, setApps] = useState<TwitterApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [formData, setFormData] = useState<AppFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchApps();
    }
  }, [status]);

  const fetchApps = async () => {
    try {
      const res = await fetch('/api/twitter-apps');
      const data = await res.json();
      setApps(data.apps || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load Twitter Apps' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingApp(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = async (appId: string) => {
    try {
      const res = await fetch(`/api/twitter-apps/${appId}`);
      if (!res.ok) throw new Error('Failed to load app');
      const data = await res.json();
      const app = data.app;
      setEditingApp(appId);
      setFormData({
        name: app.name,
        consumerKey: app.consumerKey,
        consumerSecret: app.consumerSecret,
        clientId: app.clientId || '',
        clientSecret: app.clientSecret || '',
        bearerToken: app.bearerToken,
        webhookEnv: app.webhookEnv,
        registerWebhook: false, // Not used for editing
      });
      setShowModal(true);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load app details' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const url = editingApp ? `/api/twitter-apps/${editingApp}` : '/api/twitter-apps';
      const method = editingApp ? 'PUT' : 'POST';

      // Extract registerWebhook flag and send it separately for POST
      const { registerWebhook, ...apiData } = formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'POST' ? { ...apiData, registerWebhook } : apiData),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
        return;
      }

      setMessage({
        type: 'success',
        text: editingApp ? 'Twitter App updated successfully' : 'Twitter App created successfully',
      });
      setShowModal(false);
      await fetchApps();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save Twitter App' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (appId: string, appName: string) => {
    if (!confirm(`Delete Twitter App "${appName}"? This cannot be undone.`)) return;

    setDeletingId(appId);
    setMessage(null);

    try {
      const res = await fetch(`/api/twitter-apps/${appId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete' });
        return;
      }

      setMessage({ type: 'success', text: `Twitter App "${appName}" deleted` });
      await fetchApps();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete Twitter App' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRegisterWebhook = async (appId: string, appName: string) => {
    setRegisteringWebhook(appId);
    setMessage(null);

    try {
      const res = await fetch(`/api/twitter-apps/${appId}/register-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to register webhook. Please try again later.'
        });
        return;
      }

      setMessage({
        type: 'success',
        text: `Webhook registered successfully for "${appName}"`
      });
      await fetchApps(); // Refresh to show new webhook status
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to register webhook. Please check your network connection.'
      });
    } finally {
      setRegisteringWebhook(null);
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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium mb-1 flex items-center gap-1 cursor-pointer"
            >
              ← Back to Projects
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Twitter Apps</h1>
            <p className="text-sm text-gray-500">X Forwarder</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                @{(session?.user as any)?.twitterHandle}
              </p>
              <p className="text-xs text-gray-500">Administrator</p>
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

        {/* Header with Create Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Your Twitter Apps ({apps.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage Twitter API credentials. Each app can be shared across multiple projects.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New App
          </button>
        </div>

        {/* Apps List */}
        {apps.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Twitter Apps configured</h3>
              <p className="text-gray-600 mb-6">
                Create a Twitter App to store your API credentials and assign it to projects.
              </p>
              <button
                onClick={openCreateModal}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200 cursor-pointer"
              >
                Create First App
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Card Body */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-sm font-bold">
                        {app.name.charAt(0).toUpperCase()}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {app.name}
                      </h3>
                    </div>
                  </div>

                  {/* Webhook Env */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-600">
                        env: <span className="font-medium">{app.webhookEnv}</span>
                      </span>
                    </div>
                  </div>

                  {/* Project count */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span className="text-sm text-gray-600">
                        {app.projectCount} project{app.projectCount !== 1 ? 's' : ''} assigned
                      </span>
                    </div>
                  </div>

                  {/* Webhook Status */}
                  <div className="mb-4">
                    {app.webhookUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${app.webhookValid ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                          <span className="text-sm text-gray-600">
                            Webhook: <span className="font-medium">{app.webhookValid ? 'Active' : 'Registered'}</span>
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded p-2 break-all">
                          <p className="text-xs text-gray-500 mb-1">Webhook URL:</p>
                          <p className="text-xs font-mono text-gray-700">{app.webhookUrl}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-700">
                                Webhook Not Configured
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Register a webhook to receive real-time events from X API.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRegisterWebhook(app.id, app.name)}
                            disabled={registeringWebhook === app.id}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium py-1.5 px-3 rounded transition duration-200 flex items-center justify-center gap-2"
                          >
                            {registeringWebhook === app.id ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Registering...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Register Webhook
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <div>
                      <span className="font-medium">Created:</span> {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Footer with Actions */}
                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(app.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                  >
                    Edit →
                  </button>
                  <button
                    onClick={() => handleDelete(app.id, app.name)}
                    disabled={deletingId === app.id}
                    className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {deletingId === app.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingApp ? 'Edit Twitter App' : 'New Twitter App'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  App Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Bitso Onchain App"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              {/* OAuth 1.0a Credentials */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-orange-600">⚠️</span> OAuth 1.0a Credentials (Legacy)
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Key (API Key)
                  </label>
                  <input
                    type="password"
                    value={formData.consumerKey}
                    onChange={(e) => setFormData({ ...formData, consumerKey: e.target.value })}
                    placeholder="OAuth 1.0a Consumer Key (optional if using OAuth 2.0)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Secret (API Secret)
                  </label>
                  <input
                    type="password"
                    value={formData.consumerSecret}
                    onChange={(e) => setFormData({ ...formData, consumerSecret: e.target.value })}
                    placeholder="OAuth 1.0a Consumer Secret (optional if using OAuth 2.0)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                </div>
              </div>

              {/* OAuth 2.0 Credentials */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-green-600">✓</span> OAuth 2.0 Credentials (Recommended)
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="password"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    placeholder="OAuth 2.0 Client ID (for user authentication)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={formData.clientSecret}
                    onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                    placeholder="OAuth 2.0 Client Secret (for user authentication)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bearer Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.bearerToken}
                  onChange={(e) => setFormData({ ...formData, bearerToken: e.target.value })}
                  placeholder="App-only Bearer Token (for read-only operations)"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for read-only API access. Generated from your app&apos;s keys and secrets.
                </p>
              </div>

              {/* Webhook Registration Option (only for new apps) */}
              {!editingApp && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.registerWebhook}
                      onChange={(e) => setFormData({ ...formData, registerWebhook: e.target.checked })}
                      className="mt-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">
                        Register webhook with X API
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Automatically register a webhook URL to receive real-time events. You can also do this later if needed.
                        Requires valid Bearer Token.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Help Text */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> You must provide either OAuth 1.0a credentials (Consumer Key/Secret) or OAuth 2.0 credentials (Client ID/Secret), or both. OAuth 2.0 is recommended for new apps.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Webhook Environment
                </label>
                <input
                  type="text"
                  value={formData.webhookEnv}
                  onChange={(e) => setFormData({ ...formData, webhookEnv: e.target.value })}
                  placeholder="production"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Twitter webhook environment name (usually &quot;production&quot;)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  {saving ? 'Saving...' : editingApp ? 'Save Changes' : 'Create App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
