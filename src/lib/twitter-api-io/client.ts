/**
 * TwitterAPI.io Client
 * Alternative API for fetching Twitter data to reduce official API consumption
 */

interface TwitterApiIoConfig {
  apiKey: string;
  baseUrl?: string;
}

interface TwitterApiIoUser {
  id: string;
  id_str: string;
  name: string;
  screen_name: string;
  description: string;
  profile_image_url_https: string;
  profile_banner_url?: string;
  followers_count: number;
  friends_count: number;
  statuses_count: number;
  created_at: string;
  verified: boolean;
  protected: boolean;
  location?: string;
  url?: string;
  entities?: any;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

interface TwitterApiIoTweet {
  id: string;
  id_str: string;
  text: string;
  created_at: string;
  user: TwitterApiIoUser;
  retweet_count: number;
  favorite_count: number;
  reply_count?: number;
  quote_count?: number;
  impression_count?: number;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  entities?: any;
  extended_entities?: any;
}

interface FollowingResponse {
  users: TwitterApiIoUser[];
  next_cursor?: string;
  has_more: boolean;
}

export class TwitterApiIoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: TwitterApiIoConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.twitterapi.io';
  }

  /**
   * Get user information by username
   */
  async getUserByUsername(username: string): Promise<TwitterApiIoUser> {
    const response = await fetch(`${this.baseUrl}/twitter/user/info_by_username?username=${username}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Get multiple users by IDs (batch operation)
   */
  async getUsersByIds(userIds: string[]): Promise<TwitterApiIoUser[]> {
    const idsParam = userIds.join(',');
    const response = await fetch(`${this.baseUrl}/twitter/user/batch_info_by_ids?userIds=${idsParam}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.users || data;
  }

  /**
   * Get user's followers
   */
  async getUserFollowers(username: string, cursor?: string): Promise<FollowingResponse> {
    const url = new URL(`${this.baseUrl}/twitter/user/followers`);
    url.searchParams.append('userName', username); // TwitterAPI.io uses 'userName' not 'username'
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // TwitterAPI.io returns { followers: [...], ... } not { users: [...] }
    return {
      users: result.followers || [],
      next_cursor: result.next_cursor,
      has_more: result.has_more || false
    };
  }

  /**
   * Get users that a user is following
   */
  async getUserFollowing(username: string, cursor?: string): Promise<FollowingResponse> {
    const url = new URL(`${this.baseUrl}/twitter/user/followings`); // Note: plural 'followings'
    url.searchParams.append('userName', username); // TwitterAPI.io uses 'userName' not 'username'
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // TwitterAPI.io returns { followings: [...], ... } not { users: [...] }
    return {
      users: result.followings || [],
      next_cursor: result.next_cursor,
      has_more: result.has_more || false
    };
  }

  /**
   * Check if userA follows userB
   */
  async checkFollowRelationship(userA: string, userB: string): Promise<boolean> {
    const url = new URL(`${this.baseUrl}/twitter/user/check_follow`);
    url.searchParams.append('source', userA);
    url.searchParams.append('target', userB);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.following || false;
  }

  /**
   * Get user's recent tweets
   * Note: TwitterAPI.io always returns 20 tweets per page, count parameter is ignored
   */
  async getUserTweets(username: string, count: number = 20, cursor?: string): Promise<{
    tweets: TwitterApiIoTweet[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/user/last_tweets`); // Correct endpoint path
    url.searchParams.append('userName', username); // TwitterAPI.io uses 'userName' not 'username'
    // Note: TwitterAPI.io doesn't support count parameter, always returns 20 items
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // TwitterAPI.io returns data in a nested structure: { status, code, msg, data: { tweets, has_next_page, next_cursor } }
    if (result.status === 'success' && result.data) {
      return {
        tweets: result.data.tweets || [],
        next_cursor: result.data.next_cursor,
        has_more: result.data.has_next_page || false
      };
    }

    // Fallback for unexpected response structure
    return {
      tweets: result.tweets || [],
      next_cursor: result.next_cursor,
      has_more: result.has_more || false
    };
  }

  /**
   * Search tweets with advanced filters
   * Note: TwitterAPI.io requires queryType parameter (Latest or Top)
   */
  async searchTweets(query: string, options?: {
    count?: number;
    cursor?: string;
    from?: string;
    to?: string;
    lang?: string;
    filter?: string;
  }): Promise<{
    tweets: TwitterApiIoTweet[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/tweet/advanced_search`); // Correct endpoint path
    url.searchParams.append('query', query); // TwitterAPI.io uses 'query' not 'q'
    url.searchParams.append('queryType', 'Latest'); // Required parameter, default to Latest

    // Note: TwitterAPI.io advanced_search doesn't support these parameters directly
    // They should be included in the query string using Twitter's advanced search syntax
    // e.g., "from:username" or "to:username" in the query itself
    if (options?.cursor) url.searchParams.append('cursor', options.cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Search users by keyword
   */
  async searchUsers(query: string, options?: {
    count?: number;
    cursor?: string;
  }): Promise<{
    users: TwitterApiIoUser[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/user/search`); // Correct endpoint path
    url.searchParams.append('query', query); // TwitterAPI.io uses 'query' not 'q'

    // Note: TwitterAPI.io doesn't support count parameter for user search
    if (options?.cursor) url.searchParams.append('cursor', options.cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get tweet by ID
   */
  async getTweetById(tweetId: string): Promise<TwitterApiIoTweet> {
    // Use the batch endpoint with a single ID as the single tweet endpoint doesn't exist
    const response = await fetch(`${this.baseUrl}/twitter/tweets?tweet_ids=${tweetId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // TwitterAPI.io returns an array of tweets
    if (!data.tweets || data.tweets.length === 0) {
      throw new Error('Tweet not found');
    }

    return data.tweets[0];
  }

  /**
   * Get multiple tweets by IDs
   */
  async getTweetsByIds(tweetIds: string[]): Promise<TwitterApiIoTweet[]> {
    const idsParam = tweetIds.join(','); // No spaces between IDs
    const response = await fetch(`${this.baseUrl}/twitter/tweets?tweet_ids=${idsParam}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.tweets || [];
  }

  /**
   * Get tweet replies
   */
  async getTweetReplies(tweetId: string, cursor?: string): Promise<{
    tweets: TwitterApiIoTweet[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/tweet/replies`);
    url.searchParams.append('tweetId', tweetId);
    if (cursor) url.searchParams.append('cursor', cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get tweet quotes
   */
  async getTweetQuotes(tweetId: string, cursor?: string): Promise<{
    tweets: TwitterApiIoTweet[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/tweet/quotes`);
    url.searchParams.append('tweetId', tweetId);
    if (cursor) url.searchParams.append('cursor', cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TwitterAPI.io error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Convert TwitterAPI.io user format to our API format
   */
  static convertUserToApiFormat(user: TwitterApiIoUser): any {
    return {
      id: user.id_str || user.id,
      username: user.screen_name,
      name: user.name,
      description: user.description || '',
      created_at: user.created_at,
      profile_image_url: user.profile_image_url_https,
      verified: user.verified || false,
      protected: user.protected || false,
      location: user.location || '',
      url: user.url || '',
      public_metrics: user.public_metrics || {
        followers_count: user.followers_count || 0,
        following_count: user.friends_count || 0,
        tweet_count: user.statuses_count || 0,
        listed_count: 0
      },
      // Additional computed fields
      followers_count: user.followers_count || user.public_metrics?.followers_count || 0,
      following_count: user.friends_count || user.public_metrics?.following_count || 0,
      tweet_count: user.statuses_count || user.public_metrics?.tweet_count || 0,
      account_age_days: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Convert TwitterAPI.io tweet format to our API format
   */
  static convertTweetToApiFormat(tweet: any): any {
    // Handle new TwitterAPI.io response structure from /last_tweets endpoint
    if (tweet.type === 'tweet') {
      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.createdAt,
        author_id: tweet.author?.id,
        public_metrics: {
          retweet_count: tweet.retweetCount || 0,
          like_count: tweet.likeCount || 0,
          reply_count: tweet.replyCount || 0,
          quote_count: tweet.quoteCount || 0,
          impression_count: tweet.viewCount || 0
        },
        in_reply_to_user_id: tweet.inReplyToUserId,
        referenced_tweets: tweet.inReplyToId ? [{
          type: 'replied_to',
          id: tweet.inReplyToId
        }] : undefined,
        entities: tweet.entities,
        attachments: tweet.extendedEntities,
        // Additional fields
        url: tweet.url,
        is_reply: tweet.isReply || false,
        conversation_id: tweet.conversationId,
        lang: tweet.lang,
        source: tweet.source
      };
    }

    // Handle legacy TwitterAPI.io tweet format (from other endpoints)
    return {
      id: tweet.id_str || tweet.id,
      text: tweet.text,
      created_at: tweet.created_at || tweet.createdAt,
      author_id: tweet.user?.id_str || tweet.user?.id || tweet.author?.id,
      public_metrics: {
        retweet_count: tweet.retweet_count || tweet.retweetCount || 0,
        like_count: tweet.favorite_count || tweet.likeCount || 0,
        reply_count: tweet.reply_count || tweet.replyCount || 0,
        quote_count: tweet.quote_count || tweet.quoteCount || 0,
        impression_count: tweet.impression_count || tweet.viewCount || 0
      },
      in_reply_to_user_id: tweet.in_reply_to_user_id_str || tweet.inReplyToUserId,
      referenced_tweets: (tweet.in_reply_to_status_id_str || tweet.inReplyToId) ? [{
        type: 'replied_to',
        id: tweet.in_reply_to_status_id_str || tweet.inReplyToId
      }] : undefined,
      entities: tweet.entities,
      attachments: tweet.extended_entities || tweet.extendedEntities
    };
  }
}

// Singleton instance
let client: TwitterApiIoClient | null = null;

export function getTwitterApiIoClient(): TwitterApiIoClient {
  if (!client) {
    const apiKey = process.env.TWITTERAPI_IO_API_KEY;
    if (!apiKey) {
      throw new Error('TWITTERAPI_IO_API_KEY environment variable is not set');
    }
    client = new TwitterApiIoClient({ apiKey });
  }
  return client;
}