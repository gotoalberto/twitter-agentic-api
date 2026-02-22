'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TwitterApp {
  id: string;
  name: string;
  webhookEnv: string;
  hasConsumerKey: boolean;
  hasConsumerSecret: boolean;
  hasBearerToken: boolean;
}

interface Webhook {
  id: string;
  url: string;
  valid?: boolean;
  created_at?: string;
}

interface TestResult {
  success: boolean;
  webhookId?: string;
  webhookUrl?: string;
  method?: string;
  error?: string;
  analysis?: string;
  solution?: string;
  verification?: {
    instruction: string;
    steps: string[];
  };
  results?: any;
  webhooks?: any;
}

export default function WebhookTestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [twitterApps, setTwitterApps] = useState<TwitterApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [customWebhookUrl, setCustomWebhookUrl] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin');
    }
  }, [status, router]);

  // Fetch Twitter Apps on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchTwitterApps();
    }
  }, [status]);

  // Fetch webhooks when app is selected
  useEffect(() => {
    if (selectedAppId) {
      fetchWebhooks(selectedAppId);
    }
  }, [selectedAppId]);

  const fetchTwitterApps = async () => {
    try {
      const res = await fetch('/api/twitter-apps');
      const data = await res.json();
      setTwitterApps(data.apps || []);
      if (data.apps?.length > 0) {
        setSelectedAppId(data.apps[0].id);
      }
    } catch (error) {
      console.error('Error fetching Twitter Apps:', error);
    }
  };

  const fetchWebhooks = async (appId: string) => {
    setLoadingWebhooks(true);
    try {
      const app = twitterApps.find(a => a.id === appId);
      if (!app?.hasBearerToken) {
        setWebhooks([]);
        return;
      }

      // Call the API to list webhooks
      const res = await fetch(`/api/twitter-apps/${appId}`, {
        method: 'GET',
      });

      if (res.ok) {
        const data = await res.json();
        // Assuming the API returns webhooks in the app data
        // We might need to create a separate endpoint for listing webhooks
        setWebhooks([]); // For now, empty until we have the list endpoint
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      setWebhooks([]);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const testWebhookRegistration = async () => {
    if (!selectedAppId) {
      alert('Please select a Twitter App');
      return;
    }

    setLoading(true);
    setTestResults(null);

    try {
      const body: any = { twitterAppId: selectedAppId };
      if (customWebhookUrl) {
        body.webhookUrl = customWebhookUrl;
      }

      const res = await fetch('/api/test/webhook-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setTestResults(data);

      // Refresh webhooks list if successful
      if (data.success) {
        await fetchWebhooks(selectedAppId);
      }
    } catch (error: any) {
      setTestResults({
        success: false,
        error: error.message || 'Test failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhookDeletion = async () => {
    if (!selectedAppId) {
      alert('Please select a Twitter App');
      return;
    }

    if (!selectedWebhookId) {
      alert('Please enter a Webhook ID to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete webhook ${selectedWebhookId}?`)) {
      return;
    }

    setLoading(true);
    setTestResults(null);

    try {
      const res = await fetch('/api/test/webhook-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitterAppId: selectedAppId,
          webhookId: selectedWebhookId,
        }),
      });

      const data = await res.json();
      setTestResults(data);

      // Refresh webhooks list if successful
      if (data.success) {
        await fetchWebhooks(selectedAppId);
        setSelectedWebhookId('');
      }
    } catch (error: any) {
      setTestResults({
        success: false,
        error: error.message || 'Test failed',
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  const selectedApp = twitterApps.find(a => a.id === selectedAppId);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">🧪 Webhook Registration Test</h1>

        {/* App Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Twitter App</h2>

          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="w-full p-2 border rounded-md mb-4"
          >
            <option value="">Select an app...</option>
            {twitterApps.map(app => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.webhookEnv})
              </option>
            ))}
          </select>

          {selectedApp && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-semibold mb-2">App Credentials Status:</h3>
              <ul className="space-y-1">
                <li>
                  Consumer Key: {selectedApp.hasConsumerKey ? '✅ Configured' : '❌ Missing'}
                </li>
                <li>
                  Consumer Secret: {selectedApp.hasConsumerSecret ? '✅ Configured' : '❌ Missing'}
                </li>
                <li>
                  Bearer Token: {selectedApp.hasBearerToken ? '✅ Configured' : '❌ Missing'}
                </li>
              </ul>
              {(!selectedApp.hasConsumerKey || !selectedApp.hasConsumerSecret) && (
                <p className="mt-2 text-orange-600 text-sm">
                  ⚠️ OAuth 1.0a credentials required for webhook registration
                </p>
              )}
            </div>
          )}
        </div>

        {/* Test Registration */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test 1: Register Webhook</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Custom Webhook URL (optional)
            </label>
            <input
              type="text"
              value={customWebhookUrl}
              onChange={(e) => setCustomWebhookUrl(e.target.value)}
              placeholder="Leave empty to use default URL"
              className="w-full p-2 border rounded-md"
            />
            <p className="text-xs text-gray-600 mt-1">
              Default: https://bitso-twitter-api.vercel.app/api/webhooks/twitter/{'{appId}'}
            </p>
          </div>

          <button
            onClick={testWebhookRegistration}
            disabled={loading || !selectedAppId}
            className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Test Registration'}
          </button>

          <div className="mt-4 p-4 bg-yellow-50 rounded-md">
            <p className="text-sm">
              <strong>Note:</strong> Most new Twitter Apps don't have TAAS access required for programmatic webhook registration.
              This test will likely fail with a 403 error. Manual registration in Twitter Developer Portal may be needed.
            </p>
          </div>
        </div>

        {/* Test Deletion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test 2: Delete Webhook</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Webhook ID to Delete
            </label>
            <input
              type="text"
              value={selectedWebhookId}
              onChange={(e) => setSelectedWebhookId(e.target.value)}
              placeholder="Enter webhook ID (e.g., 1999190094972911617)"
              className="w-full p-2 border rounded-md"
            />
          </div>

          {webhooks.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Or select from existing webhooks:</p>
              <select
                value={selectedWebhookId}
                onChange={(e) => setSelectedWebhookId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select a webhook...</option>
                {webhooks.map(webhook => (
                  <option key={webhook.id} value={webhook.id}>
                    {webhook.id} - {webhook.url}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={testWebhookDeletion}
            disabled={loading || !selectedAppId || !selectedWebhookId}
            className="bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Test Deletion'}
          </button>

          <div className="mt-4 p-4 bg-yellow-50 rounded-md">
            <p className="text-sm">
              <strong>Warning:</strong> This will permanently delete the webhook.
              The app will need to register a new webhook afterward.
            </p>
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className={`bg-white rounded-lg shadow-md p-6 ${testResults.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
            <h2 className="text-xl font-semibold mb-4">
              {testResults.success ? '✅ Test Successful' : '❌ Test Failed'}
            </h2>

            {testResults.webhookId && (
              <div className="mb-4">
                <p><strong>Webhook ID:</strong> {testResults.webhookId}</p>
                {testResults.webhookUrl && (
                  <p><strong>Webhook URL:</strong> {testResults.webhookUrl}</p>
                )}
                {testResults.method && (
                  <p><strong>Method Used:</strong> {testResults.method}</p>
                )}
              </div>
            )}

            {testResults.error && (
              <div className="mb-4 p-4 bg-red-50 rounded-md">
                <p className="text-red-700"><strong>Error:</strong> {testResults.error}</p>
                {testResults.analysis && (
                  <p className="mt-2"><strong>Analysis:</strong> {testResults.analysis}</p>
                )}
                {testResults.solution && (
                  <p className="mt-2"><strong>Solution:</strong> {testResults.solution}</p>
                )}
              </div>
            )}

            {testResults.results && (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold mb-2">API Test Results:</h3>
                {testResults.results.v1 && (
                  <div className="mb-2">
                    <p><strong>v1.1 API:</strong></p>
                    <ul className="ml-4">
                      <li>Attempted: {testResults.results.v1.attempted ? 'Yes' : 'No'}</li>
                      <li>Success: {testResults.results.v1.success ? '✅' : '❌'}</li>
                      {testResults.results.v1.error && (
                        <li>Error: {testResults.results.v1.error}</li>
                      )}
                    </ul>
                  </div>
                )}
                {testResults.results.v2 && (
                  <div>
                    <p><strong>v2 API:</strong></p>
                    <ul className="ml-4">
                      <li>Attempted: {testResults.results.v2.attempted ? 'Yes' : 'No'}</li>
                      <li>Success: {testResults.results.v2.success ? '✅' : '❌'}</li>
                      {testResults.results.v2.error && (
                        <li>Error: {testResults.results.v2.error}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {testResults.webhooks && (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold mb-2">Webhook Count:</h3>
                <p>Before: {testResults.webhooks.before} webhook(s)</p>
                <p>After: {testResults.webhooks.after} webhook(s)</p>
                {testResults.webhooks.targetRemoved !== undefined && (
                  <p>Target Removed: {testResults.webhooks.targetRemoved ? '✅ Yes' : '❌ No'}</p>
                )}
              </div>
            )}

            {testResults.verification && (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <h3 className="font-semibold mb-2">📋 {testResults.verification.instruction}</h3>
                <ol className="list-decimal ml-5 space-y-1">
                  {testResults.verification.steps.map((step, index) => (
                    <li key={index} className="text-sm">{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-3">📚 How to Verify in Twitter Developer Portal</h3>
          <ol className="list-decimal ml-5 space-y-2 text-sm">
            <li>Go to <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Twitter Developer Portal</a></li>
            <li>Select your app from the list</li>
            <li>Navigate to "Products" → "Webhooks" or "Account Activity API"</li>
            <li>Check the webhook list to see registered webhooks</li>
            <li>Verify webhook ID and URL match what's shown in test results</li>
            <li>For deletion, confirm the webhook is no longer listed</li>
          </ol>
        </div>
      </div>
    </div>
  );
}