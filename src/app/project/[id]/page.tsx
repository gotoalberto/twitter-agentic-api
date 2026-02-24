'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  bot: {
    id: string;
    username: string;
    userId: string;
  } | null;
  twitterApp: {
    id: string;
    name: string;
  } | null;
}

interface BotStatus {
  connected: boolean;
  bot: {
    userId: string;
    username: string;
    connectedAt: string;
  } | null;
  oauth: {
    oauth1: {
      connected: boolean;
      hasAccessToken: boolean;
      hasAccessTokenSecret: boolean;
      capabilities: string[];
    };
    oauth2: {
      connected: boolean;
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      expiresAt: string | null;
      isExpired: boolean;
      scopes: string[];
      capabilities: string[];
    };
    hasFullCapabilities: boolean;
    recommendedAction: string | null;
  };
  webhookStatus: {
    registered: boolean;
    webhookId?: string;
    url?: string;
    subscribed?: boolean;
  };
}

export default function PublicProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (project?.bot) {
      fetchBotStatus();
    }
  }, [project]);

  const fetchProject = async () => {
    try {
      // Fetch project info without authentication
      const res = await fetch(`/api/projects/${projectId}/public`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Project not found');
        } else {
          setError('Failed to load project');
        }
        return;
      }

      const data = await res.json();
      setProject(data.project);
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/bot/status`);
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  };

  const connectOAuth1 = () => {
    window.location.href = `/api/projects/${projectId}/bot/authorize-oauth1`;
  };

  const connectOAuth2 = () => {
    window.location.href = `/api/projects/${projectId}/bot/authorize-oauth2`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="mt-4 text-lg font-medium text-gray-900">{error}</h2>
            <p className="mt-2 text-sm text-gray-500">
              The project you're looking for doesn't exist or has been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Twitter Bot Configuration</p>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          {project.bot ? (
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bot Connected</h2>

                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-center gap-3 text-lg">
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd"/>
                    </svg>
                    <span className="font-mono text-gray-900">@{project.bot.username}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    User ID: {project.bot.userId}
                  </p>
                </div>
              </div>

              {/* OAuth Status Cards */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* OAuth 1.0a Card */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-gray-900">OAuth 1.0a</h3>
                    {botStatus?.oauth?.oauth1?.connected ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">Required for:</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Media uploads (images, videos, GIFs)</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Direct messages</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Webhook subscriptions</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Legacy API v1.1 endpoints</span>
                      </li>
                    </ul>
                  </div>

                  {!botStatus?.oauth?.oauth1?.connected && (
                    <button
                      onClick={connectOAuth1}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200"
                    >
                      Connect OAuth 1.0a
                    </button>
                  )}

                  {botStatus?.oauth?.oauth1?.connected && (
                    <div className="bg-green-50 rounded-md p-3">
                      <p className="text-xs text-green-800">
                        <svg className="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Full media & DM capabilities enabled
                      </p>
                    </div>
                  )}
                </div>

                {/* OAuth 2.0 Card */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-gray-900">OAuth 2.0</h3>
                    {botStatus?.oauth?.oauth2?.connected ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">Provides:</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Text-only tweets</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>User profile access</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Modern API v2 endpoints</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        <span>No media upload support</span>
                      </li>
                    </ul>
                  </div>

                  {!botStatus?.oauth?.oauth2?.connected && (
                    <button
                      onClick={connectOAuth2}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200"
                    >
                      Connect OAuth 2.0
                    </button>
                  )}

                  {botStatus?.oauth?.oauth2?.connected && (
                    <div className="bg-green-50 rounded-md p-3">
                      <p className="text-xs text-green-800">
                        <svg className="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Modern API access enabled
                        {botStatus.oauth.oauth2.isExpired && ' (Token expired)'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              {botStatus && (
                <div className="mt-6">
                  {botStatus.oauth.hasFullCapabilities ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800">
                        <svg className="inline w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <strong>Full capabilities enabled!</strong> Your bot can post tweets with media, send DMs, and use all Twitter API features.
                      </p>
                    </div>
                  ) : botStatus.oauth.recommendedAction === 'connect_oauth1_for_media' ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <svg className="inline w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        <strong>Recommendation:</strong> Connect OAuth 1.0a to enable media uploads (images, videos) and direct messages.
                      </p>
                    </div>
                  ) : botStatus.oauth.recommendedAction === 'connect_oauth2_for_modern_api' ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <svg className="inline w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        <strong>Recommendation:</strong> Connect OAuth 2.0 to access modern Twitter API v2 features.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Share this link</strong> with anyone who needs to connect their bot to this project. No login required!
                </p>
              </div>
            </div>
          ) : !project.twitterApp ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration Required</h2>
              <p className="text-gray-600 mb-6">
                This project needs to be configured by an administrator before you can connect a bot.
              </p>

              <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Please contact the project administrator to complete the setup. A Twitter App must be assigned to this project first.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Twitter Bot</h2>
                <p className="text-gray-600 mb-6">
                  Choose how to connect your Twitter bot account. You can connect with one or both authentication methods.
                </p>
              </div>

              {/* OAuth Options */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* OAuth 1.0a Card */}
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">OAuth 1.0a</h3>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-700">Best for:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span><strong>Media tweets</strong> (images, videos, GIFs)</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Direct messages</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Webhook subscriptions</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>All v1.1 API features</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={connectOAuth1}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    Connect with OAuth 1.0a
                  </button>
                </div>

                {/* OAuth 2.0 Card */}
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">OAuth 2.0</h3>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-700">Features:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Text-only tweets</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>Modern API v2</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span>User profile access</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <svg className="w-3 h-3 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-yellow-700">No media uploads</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={connectOAuth2}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8.39 13.77a.75.75 0 11-1.06-1.06l2.47-2.47-2.47-2.47a.75.75 0 011.06-1.06l3 3a.75.75 0 010 1.06l-3 3z"/>
                    </svg>
                    Connect with OAuth 2.0
                  </button>
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <svg className="inline w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  <strong>Recommendation:</strong> Connect with OAuth 1.0a if you need to post images or videos. You can always add OAuth 2.0 later.
                </p>
              </div>

              <p className="text-center text-xs text-gray-500">
                By connecting, you authorize this project to access your Twitter account data.
                <br />
                Share this link with anyone who needs to connect their bot - no login required!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Powered by X Forwarder • <a href="/" className="text-blue-600 hover:underline">Learn more</a>
          </p>
        </div>
      </div>
    </div>
  );
}