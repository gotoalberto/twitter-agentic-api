'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TwitterApp {
  id: string;
  name: string;
  webhookEnv: string;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

interface AppFormData {
  name: string;
  consumerKey: string;
  consumerSecret: string;
  bearerToken: string;
  webhookEnv: string;
}

const emptyForm: AppFormData = {
  name: '',
  consumerKey: '',
  consumerSecret: '',
  bearerToken: '',
  webhookEnv: 'production',
};

export default function AppsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [apps, setApps] = useState<TwitterApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        bearerToken: app.bearerToken,
        webhookEnv: app.webhookEnv,
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white">Twitter Apps</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage Twitter API credentials. Each app can be shared across multiple projects.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New App
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-900/50 border border-green-700 text-green-300'
                : 'bg-red-900/50 border border-red-700 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Apps List */}
        {apps.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h3 className="text-lg font-medium text-white mb-2">No Twitter Apps configured</h3>
            <p className="text-gray-400 text-sm mb-6">
              Create a Twitter App to store your API credentials and assign it to projects.
            </p>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Create First App
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => (
              <div
                key={app.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-900/50 rounded-lg flex items-center justify-center text-blue-400 text-sm font-bold">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{app.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">
                          env: <span className="text-gray-400">{app.webhookEnv}</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {app.projectCount} project{app.projectCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(app.id)}
                    className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(app.id, app.name)}
                    disabled={deletingId === app.id}
                    className="text-sm text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-900/50 hover:border-red-700 transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                {editingApp ? 'Edit Twitter App' : 'New Twitter App'}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    App Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bitso Onchain App"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Consumer Key (API Key) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.consumerKey}
                    onChange={(e) => setFormData({ ...formData, consumerKey: e.target.value })}
                    placeholder="OAuth 1.0a Consumer Key"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Consumer Secret (API Secret) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.consumerSecret}
                    onChange={(e) => setFormData({ ...formData, consumerSecret: e.target.value })}
                    placeholder="OAuth 1.0a Consumer Secret"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Bearer Token <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.bearerToken}
                    onChange={(e) => setFormData({ ...formData, bearerToken: e.target.value })}
                    placeholder="App-only Bearer Token"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Webhook Environment
                  </label>
                  <input
                    type="text"
                    value={formData.webhookEnv}
                    onChange={(e) => setFormData({ ...formData, webhookEnv: e.target.value })}
                    placeholder="production"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Twitter webhook environment name (usually "production")
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
                  >
                    {saving ? 'Saving...' : editingApp ? 'Save Changes' : 'Create App'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
