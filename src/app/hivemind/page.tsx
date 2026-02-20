'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HivemindDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hivemindStatus, setHivemindStatus] = useState<any>(null);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    // Check if user is connected to Hivemind
    const checkHivemindStatus = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/hivemind/status');
          if (response.ok) {
            const data = await response.json();
            setIsConnected(data.isConnected);
            setHivemindStatus(data);
          }
        } catch (error) {
          console.error('Error checking Hivemind status:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (status === 'authenticated') {
      checkHivemindStatus();
    }
  }, [session, status]);

  const handleJoinHivemind = async () => {
    try {
      // Redirect to OAuth flow for Hivemind
      window.location.href = '/api/hivemind/authorize';
    } catch (error) {
      console.error('Error joining Hivemind:', error);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Hivemind?')) {
      return;
    }

    try {
      const response = await fetch('/api/hivemind/disconnect', {
        method: 'POST'
      });

      if (response.ok) {
        setIsConnected(false);
        setHivemindStatus(null);
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting from Hivemind:', error);
      alert('Failed to disconnect from Hivemind. Please try again.');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <p className="text-gray-600 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                Hivemind Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Welcome, @{session?.user?.username || session?.user?.name}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Connection Status */}
          <div className="mb-8">
            <div className={`rounded-lg p-6 ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    Connection Status
                  </h2>
                  <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-gray-600'}`}>
                    {isConnected
                      ? `✓ Connected to Hivemind as @${hivemindStatus?.username}`
                      : 'Not connected to Hivemind'}
                  </p>
                  {isConnected && hivemindStatus?.connectedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Connected since {new Date(hivemindStatus.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {!isConnected ? (
                  <button
                    onClick={handleJoinHivemind}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Join Hivemind
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Permissions Info */}
          {isConnected && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Granted Permissions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Tweet Publishing</p>
                      <p className="text-sm text-gray-600">Post tweets on your behalf</p>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Direct Messages</p>
                      <p className="text-sm text-gray-600">Send DMs from your account</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Information Panel */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              About Hivemind
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                Hivemind is a distributed Twitter automation network that allows coordinated actions
                while maintaining individual account control.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2 mt-0.5">•</span>
                  <span>Your credentials are encrypted and stored securely</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2 mt-0.5">•</span>
                  <span>No webhook events are received from your account</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2 mt-0.5">•</span>
                  <span>You can disconnect at any time to revoke access</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2 mt-0.5">•</span>
                  <span>Your account remains under your full control</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}