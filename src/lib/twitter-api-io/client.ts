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
    url.searchParams.append('username', username);
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

    return response.json();
  }

  /**
   * Get users that a user is following
   */
  async getUserFollowing(username: string, cursor?: string): Promise<FollowingResponse> {
    const url = new URL(`${this.baseUrl}/twitter/user/following`);
    url.searchParams.append('username', username);
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

    return response.json();
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
   */
  async getUserTweets(username: string, count: number = 20, cursor?: string): Promise<{
    tweets: TwitterApiIoTweet[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const url = new URL(`${this.baseUrl}/twitter/user/tweets`);
    url.searchParams.append('username', username);
    url.searchParams.append('count', count.toString());
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

    return response.json();
  }

  /**
   * Search tweets with advanced filters
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
    const url = new URL(`${this.baseUrl}/twitter/search/tweets`);
    url.searchParams.append('q', query);

    if (options?.count) url.searchParams.append('count', options.count.toString());
    if (options?.cursor) url.searchParams.append('cursor', options.cursor);
    if (options?.from) url.searchParams.append('from', options.from);
    if (options?.to) url.searchParams.append('to', options.to);
    if (options?.lang) url.searchParams.append('lang', options.lang);
    if (options?.filter) url.searchParams.append('filter', options.filter);

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
    const url = new URL(`${this.baseUrl}/twitter/search/users`);
    url.searchParams.append('q', query);

    if (options?.count) url.searchParams.append('count', options.count.toString());
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
    const response = await fetch(`${this.baseUrl}/twitter/tweet/info?tweetId=${tweetId}`, {
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
   * Get multiple tweets by IDs
   */
  async getTweetsByIds(tweetIds: string[]): Promise<TwitterApiIoTweet[]> {
    const idsParam = tweetIds.join(',');
    const response = await fetch(`${this.baseUrl}/twitter/tweet/batch_info?tweetIds=${idsParam}`, {
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
    return data.tweets || data;
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
  static convertTweetToApiFormat(tweet: TwitterApiIoTweet): any {
    return {
      id: tweet.id_str || tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      author_id: tweet.user?.id_str || tweet.user?.id,
      public_metrics: {
        retweet_count: tweet.retweet_count || 0,
        like_count: tweet.favorite_count || 0,
        reply_count: tweet.reply_count || 0,
        quote_count: tweet.quote_count || 0,
        impression_count: tweet.impression_count || 0
      },
      in_reply_to_user_id: tweet.in_reply_to_user_id_str,
      referenced_tweets: tweet.in_reply_to_status_id_str ? [{
        type: 'replied_to',
        id: tweet.in_reply_to_status_id_str
      }] : undefined,
      entities: tweet.entities,
      attachments: tweet.extended_entities
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