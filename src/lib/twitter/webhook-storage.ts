import { redis, REDIS_KEYS } from '@/lib/db/redis';
import type { WebhookRegistration } from '@/types/bot';

/**
 * Save webhook registration info to Redis
 */
export async function saveWebhookRegistration(webhook: WebhookRegistration): Promise<void> {
  await redis.set(REDIS_KEYS.WEBHOOK_REGISTRATION, JSON.stringify(webhook));
  console.log('✅ Webhook registration saved to Redis');
}

/**
 * Get webhook registration info from Redis
 */
export async function getWebhookRegistration(): Promise<WebhookRegistration | null> {
  const data = await redis.get(REDIS_KEYS.WEBHOOK_REGISTRATION);

  if (!data) {
    return null;
  }

  // Handle both string and object returns from Upstash Redis
  const webhook = (typeof data === 'string' ? JSON.parse(data) : data) as WebhookRegistration;
  return webhook;
}

/**
 * Delete webhook registration info from Redis
 */
export async function deleteWebhookRegistration(): Promise<void> {
  await redis.del(REDIS_KEYS.WEBHOOK_REGISTRATION);
  console.log('✅ Webhook registration deleted from Redis');
}

/**
 * Update last CRC check timestamp
 */
export async function updateLastCrcCheck(): Promise<void> {
  const webhook = await getWebhookRegistration();

  if (webhook) {
    webhook.lastCrcCheck = new Date().toISOString();
    await saveWebhookRegistration(webhook);
  }
}
