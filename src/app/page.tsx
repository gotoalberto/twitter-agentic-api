'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HivemindPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If authenticated, redirect to hivemind dashboard
    if (status === 'authenticated') {
      router.push('/hivemind');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  // If already authenticated, show loading while redirecting
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <p className="text-gray-600 text-lg">Redirecting to Hivemind dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 mx-4">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-3">
            Hivemind
          </h1>
          <p className="text-gray-600 text-lg">
            Join the collective consciousness
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              What is Hivemind?
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Connect your Twitter account to become part of a distributed network.
              Grant selective permissions for automated actions while maintaining
              full control over your account.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">By joining, you enable:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">✓</span>
                <span>Automated tweet publishing on your behalf</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">✓</span>
                <span>Direct message capabilities</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">✓</span>
                <span>Full control to disconnect at any time</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => signIn('twitter', { callbackUrl: '/hivemind' })}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Join Hivemind with Twitter
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <a
              href="/admin"
              className="hover:text-purple-600 transition-colors"
            >
              Admin Access
            </a>
            <span>Powered by X Forwarder</span>
          </div>
        </div>
      </div>
    </div>
  );
}