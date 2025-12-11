import { Redis } from '@upstash/redis';

// Keys
export const REDIS_KEYS = {
  BOT_CONNECTED: 'bot:connected',
  WEBHOOK_REGISTRATION: 'webhook:registration',
  WEBHOOK_FORWARDING: 'webhook:forwarding',
} as const;

// Lazy initialization to avoid build-time errors
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      throw new Error('UPSTASH_REDIS_REST_URL is not defined');
    }

    if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined');
    }

    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisClient;
}

// For backward compatibility
export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    return (getRedis() as any)[prop];
  },
});
