import { redis, REDIS_KEYS } from '@/lib/db/redis';

export interface WebhookForwardingConfig {
  endpoint: string;
  enabled: boolean;
  updatedAt: string;
}

/**
 * Save webhook forwarding configuration
 */
export async function saveForwardingConfig(config: WebhookForwardingConfig): Promise<void> {
  await redis.set(REDIS_KEYS.WEBHOOK_FORWARDING, JSON.stringify(config));
  console.log('✅ Forwarding config saved:', config.endpoint);
}

/**
 * Get webhook forwarding configuration
 */
export async function getForwardingConfig(): Promise<WebhookForwardingConfig | null> {
  const data = await redis.get(REDIS_KEYS.WEBHOOK_FORWARDING);

  if (!data) {
    return null;
  }

  // Handle both string and object returns from Upstash Redis
  const config = (typeof data === 'string' ? JSON.parse(data) : data) as WebhookForwardingConfig;
  return config;
}

/**
 * Delete webhook forwarding configuration
 */
export async function deleteForwardingConfig(): Promise<void> {
  await redis.del(REDIS_KEYS.WEBHOOK_FORWARDING);
  console.log('✅ Forwarding config deleted');
}
