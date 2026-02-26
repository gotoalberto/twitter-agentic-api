'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface PromotedTweet {
  id: string;
  tweetUrl: string;
  tweetId: string;
  tweetAuthor: string;
  tweetText?: string;
  submittedBy?: string;
  submittedAt: string;
  status: 'pending' | 'processing' | 'completed';
  stats: {
    likes: number;
    retweets: number;
    total: number;
  };
}

export default function RaidPage() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recentPromotions, setRecentPromotions] = useState<PromotedTweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<number>(0);

  const observerTarget = useRef(null);

  // Format date to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Validate Twitter/X URL
  const validateTweetUrl = (url: string): boolean => {
    const tweetRegex = /^https?:\/\/(twitter\.com|x\.com)\/[\w]+\/status\/[\d]+/i;
    return tweetRegex.test(url);
  };

  // Extract tweet ID from URL
  const extractTweetId = (url: string): string | null => {
    const match = url.match(/status\/([\d]+)/);
    return match ? match[1] : null;
  };

  // Load initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch recent promotions
        const promotionsResponse = await fetch('/api/hivemind/raids?limit=20');
        const promotionsData = await promotionsResponse.json();

        if (promotionsData.success) {
          setRecentPromotions(promotionsData.raids || []);
          setNextCursor(promotionsData.nextCursor);
          setHasMore(promotionsData.hasMore);
        }

        // Fetch connected users count
        const statsResponse = await fetch('/api/hivemind/public-stats');
        const statsData = await statsResponse.json();

        if (statsData.summary) {
          setConnectedUsers(statsData.summary.totalUsers || 0);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Load more promotions
  const loadMorePromotions = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const response = await fetch(`/api/hivemind/raids?cursor=${nextCursor}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setRecentPromotions(prev => [...prev, ...(data.raids || [])]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Error loading more promotions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, hasMore, loadingMore]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMorePromotions();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMorePromotions, hasMore, loadingMore]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate URL
    if (!validateTweetUrl(tweetUrl)) {
      setError('Please enter a valid Twitter/X tweet URL (e.g., https://x.com/username/status/1234567890)');
      return;
    }

    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      setError('Could not extract tweet ID from URL');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/hivemind/raids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweetUrl,
          tweetId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`Tweet submitted for promotion! ${connectedUsers} Hivemind members will engage with it.`);
        setTweetUrl('');

        // Add to recent promotions
        if (data.raid) {
          setRecentPromotions(prev => [data.raid, ...prev]);
        }

        // Trigger the raid actions
        if (data.raidId) {
          fetch(`/api/hivemind/raids/${data.raidId}/execute`, {
            method: 'POST',
          }).catch(console.error);
        }
      } else {
        setError(data.error || 'Failed to submit tweet for promotion');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError('An error occurred while submitting the tweet');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 mb-6">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              🚀 Hivemind Raid
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              Amplify your tweet with the power of the Hivemind network
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submit a tweet URL and watch as <span className="font-semibold text-blue-600 dark:text-blue-400">{connectedUsers} connected members</span> automatically like and retweet it
            </p>
          </div>
        </div>

        {/* Submission Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="tweetUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tweet URL
              </label>
              <input
                type="url"
                id="tweetUrl"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="https://x.com/username/status/1234567890"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={submitting}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Enter the full URL of the tweet you want to promote
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !tweetUrl}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:transform-none disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : '🎯 Start Raid'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">How it works:</h3>
            <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <li>1. Submit a tweet URL for promotion</li>
              <li>2. The Hivemind network receives the raid request</li>
              <li>3. All {connectedUsers} connected members automatically like and retweet</li>
              <li>4. Watch your tweet gain massive engagement instantly!</li>
            </ol>
          </div>
        </div>

        {/* Recent Promotions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Recent Raids
            </h2>
          </div>

          <div className="max-h-96 sm:max-h-[600px] overflow-y-auto">
            {recentPromotions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No raids yet. Be the first to start one!
              </div>
            ) : (
              <>
                {recentPromotions.map((promotion) => (
                  <div
                    key={promotion.id}
                    className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            promotion.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : promotion.status === 'processing'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {promotion.status === 'completed' ? '✅ Completed' :
                             promotion.status === 'processing' ? '⚡ In Progress' : '⏳ Pending'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(promotion.submittedAt)}
                          </span>
                        </div>

                        <a
                          href={promotion.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {promotion.tweetUrl}
                        </a>

                        {promotion.tweetText && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            "{promotion.tweetText}"
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <span className="text-red-600 dark:text-red-400">
                            ❤️ {promotion.stats.likes}
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            🔄 {promotion.stats.retweets}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            by @{promotion.tweetAuthor || 'unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                <div ref={observerTarget} className="p-4 text-center">
                  {loadingMore && (
                    <div className="text-gray-500 dark:text-gray-400">Loading more...</div>
                  )}
                  {!hasMore && recentPromotions.length > 0 && (
                    <div className="text-gray-400 dark:text-gray-500 text-sm">No more raids</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Raid responsibly. The Hivemind network is a powerful tool for amplification.
          </p>
        </div>
      </div>
    </div>
  );
}