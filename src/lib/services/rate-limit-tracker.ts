/**
 * Rate Limit Tracking Service
 * Captures and stores rate limit information from Twitter API responses
 */

import { prisma } from '@/lib/db/prisma';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export interface RateLimitContext {
  projectId?: string;
  accountId: string;
  accountUsername: string;
  endpoint: string;
  endpointType: EndpointType;
}

export enum EndpointType {
  TWEET = 'tweet',
  LIKE = 'like',
  RETWEET = 'retweet',
  SEARCH = 'search',
  TIMELINE = 'timeline',
  USER = 'user',
  FOLLOW = 'follow',
  DM = 'dm',
  OTHER = 'other'
}

// Map API endpoints to endpoint types
const ENDPOINT_TYPE_MAP: Record<string, EndpointType> = {
  // Tweet operations
  'POST /2/tweets': EndpointType.TWEET,
  '/statuses/update': EndpointType.TWEET,

  // Like operations
  'POST /2/users/:id/likes': EndpointType.LIKE,
  'DELETE /2/users/:id/likes/:tweet_id': EndpointType.LIKE,
  '/favorites/create': EndpointType.LIKE,
  '/favorites/destroy': EndpointType.LIKE,

  // Retweet operations
  'POST /2/users/:id/retweets': EndpointType.RETWEET,
  'DELETE /2/users/:id/retweets/:source_tweet_id': EndpointType.RETWEET,
  '/statuses/retweet/:id': EndpointType.RETWEET,
  '/statuses/unretweet/:id': EndpointType.RETWEET,

  // Search operations
  'GET /2/tweets/search/recent': EndpointType.SEARCH,
  '/search/tweets': EndpointType.SEARCH,

  // Timeline operations
  'GET /2/users/:id/tweets': EndpointType.TIMELINE,
  '/statuses/user_timeline': EndpointType.TIMELINE,
  '/statuses/home_timeline': EndpointType.TIMELINE,

  // User operations
  'GET /2/users': EndpointType.USER,
  'GET /2/users/:id': EndpointType.USER,
  '/users/lookup': EndpointType.USER,
  '/users/show/:id': EndpointType.USER,

  // Follow operations
  'POST /2/users/:id/following': EndpointType.FOLLOW,
  'DELETE /2/users/:source_user_id/following/:target_user_id': EndpointType.FOLLOW,
  '/friendships/create': EndpointType.FOLLOW,
  '/friendships/destroy': EndpointType.FOLLOW,

  // DM operations
  'POST /2/dm_conversations/with/:participant_id/messages': EndpointType.DM,
  '/direct_messages/events/new': EndpointType.DM,
};

/**
 * Get endpoint type from endpoint string
 */
export function getEndpointType(endpoint: string): EndpointType {
  // Direct match
  if (ENDPOINT_TYPE_MAP[endpoint]) {
    return ENDPOINT_TYPE_MAP[endpoint];
  }

  // Pattern matching for parameterized endpoints
  for (const [pattern, type] of Object.entries(ENDPOINT_TYPE_MAP)) {
    if (pattern.includes(':')) {
      // Convert pattern to regex (e.g., /users/:id -> /users/[^/]+)
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(endpoint)) {
        return type;
      }
    }
  }

  return EndpointType.OTHER;
}

/**
 * Save or update rate limit information
 */
export async function saveRateLimit(
  context: RateLimitContext,
  rateLimitInfo: RateLimitInfo
): Promise<void> {
  try {
    const resetDate = new Date(rateLimitInfo.reset * 1000);

    await prisma.rateLimit.upsert({
      where: {
        accountId_endpoint: {
          accountId: context.accountId,
          endpoint: context.endpoint,
        },
      },
      update: {
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        reset: resetDate,
        lastUpdated: new Date(),
        lastRequestAt: new Date(),
        projectId: context.projectId,
      },
      create: {
        accountId: context.accountId,
        accountUsername: context.accountUsername,
        endpoint: context.endpoint,
        endpointType: context.endpointType,
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        reset: resetDate,
        projectId: context.projectId,
      },
    });

    console.log(`📊 Rate limit saved: ${context.endpoint} - ${rateLimitInfo.remaining}/${rateLimitInfo.limit} (resets: ${resetDate.toISOString()})`);
  } catch (error) {
    console.error('❌ Failed to save rate limit:', error);
    // Don't throw - we don't want rate limit tracking to break API calls
  }
}

/**
 * Extract rate limit info from twitter-api-v2 response
 */
export function extractRateLimit(response: any): RateLimitInfo | null {
  // The twitter-api-v2 library adds rateLimit to responses
  if (response && response.rateLimit) {
    return {
      limit: response.rateLimit.limit,
      remaining: response.rateLimit.remaining,
      reset: response.rateLimit.reset,
    };
  }

  // Check in error objects too
  if (response && response.error && response.error.rateLimit) {
    return {
      limit: response.error.rateLimit.limit,
      remaining: response.error.rateLimit.remaining,
      reset: response.error.rateLimit.reset,
    };
  }

  return null;
}

/**
 * Get current rate limits for a project
 */
export async function getProjectRateLimits(projectId: string) {
  // Get the most recent rate limit for each endpoint
  // This includes expired ones so users can see their rate limit status
  const rateLimits = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT ON (endpoint) *
    FROM "rate_limits"
    WHERE "project_id" = ${projectId}
    ORDER BY endpoint, "last_request_at" DESC
  `;

  return formatRateLimits(rateLimits);
}

/**
 * Format rate limits for API response
 */
function formatRateLimits(rateLimits: any[]) {
  const now = Date.now();

  return rateLimits.map((rl) => {
    // Handle both Prisma objects and raw query results
    const accountId = rl.accountId || rl.account_id;
    const accountUsername = rl.accountUsername || rl.account_username;
    const endpointType = rl.endpointType || rl.endpoint_type;
    const lastRequestAt = rl.lastRequestAt || rl.last_request_at;
    const resetTime = rl.reset instanceof Date ? rl.reset : new Date(rl.reset);

    // Check if rate limit has already reset (reset time is in the past)
    const hasReset = resetTime.getTime() <= now;

    // If reset time has passed, show limits as fully available
    const remaining = hasReset ? rl.limit : rl.remaining;
    const used = rl.limit - remaining;
    const percentageUsed = Math.round((used / rl.limit) * 100);
    const resetIn = hasReset ? 0 : Math.floor((resetTime.getTime() - now) / 1000);

    return {
      id: rl.id,
      account: {
        id: accountId,
        username: accountUsername,
      },
      endpoint: rl.endpoint,
      endpointType: endpointType,
      limit: rl.limit,
      remaining: remaining,
      used: used,
      percentageUsed: percentageUsed,
      reset: resetTime.toISOString(),
      resetIn: resetIn, // seconds until reset (0 if already reset)
      lastRequestAt: lastRequestAt instanceof Date ? lastRequestAt.toISOString() : lastRequestAt,
      status: hasReset ? 'reset' : (remaining === 0 ? 'exhausted' : 'active'),
    };
  });
}

/**
 * Clean up expired rate limits (optional maintenance task)
 */
export async function cleanupExpiredRateLimits() {
  const result = await prisma.rateLimit.deleteMany({
    where: {
      reset: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Delete rate limits older than 24 hours
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} expired rate limits`);
  return result.count;
}