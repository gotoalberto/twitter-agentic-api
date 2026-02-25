'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface HivemindUser {
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  connectedAt: string;
  lastActiveAt: string;
  stats: {
    likes: number;
    retweets: number;
    total: number;
  };
}

interface ActivityAction {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    profileImageUrl?: string;
  };
  type: 'like' | 'retweet';
  tweet: {
    id: string;
    author: string;
    text?: string;
    url: string;
  };
  performedAt: string;
}

export default function StatusPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<HivemindUser[]>([]);
  const [activities, setActivities] = useState<ActivityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'like' | 'retweet'>('all');

  const observerTarget = useRef(null);

  // Format date to user's local timezone
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

  // Load initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch stats
        const statsResponse = await fetch('/api/hivemind/public-stats');
        const statsData = await statsResponse.json();
        setStats(statsData.summary);
        setUsers(statsData.users || []);

        // Fetch initial activities
        const activityResponse = await fetch('/api/hivemind/activity-feed?limit=50');
        const activityData = await activityResponse.json();
        setActivities(activityData.actions || []);
        setNextCursor(activityData.nextCursor);
        setHasMore(activityData.hasMore);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Load more activities
  const loadMoreActivities = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const url = filter === 'all'
        ? `/api/hivemind/activity-feed?cursor=${nextCursor}&limit=50`
        : `/api/hivemind/activity-feed?cursor=${nextCursor}&limit=50&type=${filter}`;

      const response = await fetch(url);
      const data = await response.json();

      setActivities(prev => [...prev, ...(data.actions || [])]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error loading more activities:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, hasMore, loadingMore, filter]);

  // Filter change
  useEffect(() => {
    const fetchFilteredActivities = async () => {
      setActivities([]);
      setNextCursor(null);
      setHasMore(true);
      setLoadingMore(true);

      try {
        const url = filter === 'all'
          ? '/api/hivemind/activity-feed?limit=50'
          : `/api/hivemind/activity-feed?limit=50&type=${filter}`;

        const response = await fetch(url);
        const data = await response.json();

        setActivities(data.actions || []);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error('Error fetching filtered activities:', error);
      } finally {
        setLoadingMore(false);
      }
    };

    fetchFilteredActivities();
  }, [filter]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreActivities();
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
  }, [loadMoreActivities, hasMore, loadingMore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Hivemind Status
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Real-time activity from the Hivemind network
          </p>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalUsers}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Active Users</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.totalLikes}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Likes</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.totalRetweets}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total RTs</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalActions}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Actions</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connected Users */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                  Connected Accounts ({users.length})
                </h2>
              </div>
              <div className="max-h-96 sm:max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.userId}
                    className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {user.profileImageUrl ? (
                        <Image
                          src={user.profileImageUrl}
                          alt={user.displayName}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 dark:text-gray-300 text-sm">
                            {user.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {user.displayName}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
                          <span className="text-red-600 dark:text-red-400">
                            ❤️ {user.stats.likes}
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            🔄 {user.stats.retweets}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatDate(user.lastActiveAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                    Activity Feed
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        filter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilter('like')}
                      className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        filter === 'like'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Likes
                    </button>
                    <button
                      onClick={() => setFilter('retweet')}
                      className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        filter === 'retweet'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      RTs
                    </button>
                  </div>
                </div>
              </div>

              <div className="max-h-96 sm:max-h-[600px] overflow-y-auto">
                {activities.map((action) => (
                  <div
                    key={action.id}
                    className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      {action.user.profileImageUrl ? (
                        <Image
                          src={action.user.profileImageUrl}
                          alt={action.user.displayName}
                          width={36}
                          height={36}
                          className="rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 dark:text-gray-300 text-xs">
                            {action.user.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-1 text-xs sm:text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {action.user.displayName}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            @{action.user.username}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-gray-400 dark:text-gray-500">
                            {formatDate(action.performedAt)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs sm:text-sm">
                          <span className={`inline-flex items-center space-x-1 ${
                            action.type === 'like' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          }`}>
                            <span>{action.type === 'like' ? '❤️ Liked' : '🔄 Retweeted'}</span>
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            a post by @{action.tweet.author}
                          </span>
                        </div>
                        {action.tweet.text && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                            "{action.tweet.text}"
                          </div>
                        )}
                        <a
                          href={action.tweet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View on Twitter →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                <div ref={observerTarget} className="p-4 text-center">
                  {loadingMore && (
                    <div className="text-gray-500 dark:text-gray-400">Loading more...</div>
                  )}
                  {!hasMore && activities.length > 0 && (
                    <div className="text-gray-400 dark:text-gray-500 text-sm">No more activities</div>
                  )}
                  {activities.length === 0 && !loadingMore && (
                    <div className="text-gray-400 dark:text-gray-500">No activities yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}