/**
 * Webhook Queue Management
 *
 * Implements a robust webhook delivery queue with:
 * - Infinite retries for failed deliveries
 * - FIFO ordering (failed webhooks go to the end of queue)
 * - Automatic retry scheduling with backoff
 */

import { prisma } from '@/lib/db/prisma';

// Configuration
const INITIAL_RETRY_DELAY_SECONDS = 30;
const WEBHOOK_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Enqueue a new webhook for delivery
 * Creates a webhook log entry with status "pending"
 *
 * @param projectId - Project ID
 * @param eventType - Type of webhook event
 * @param payload - Full webhook payload from Twitter
 * @param forwardUrl - URL to forward the webhook to
 * @returns Created webhook log
 */
export async function enqueueWebhook(
  projectId: string,
  eventType: string,
  payload: any,
  forwardUrl: string
) {
  console.log('📥 Enqueuing webhook');
  console.log('   Project ID:', projectId);
  console.log('   Event Type:', eventType);
  console.log('   Forward URL:', forwardUrl);

  const webhookLog = await prisma.webhookLog.create({
    data: {
      projectId,
      eventType,
      forwardedTo: forwardUrl,
      status: 'pending',
      payload,
      attempts: 0,
    },
  });

  console.log('   ✅ Webhook enqueued with ID:', webhookLog.id);
  return webhookLog;
}

/**
 * Deliver a specific webhook
 * Updates attempts, status, and timestamps
 *
 * @param webhookLogId - ID of the webhook log to deliver
 * @returns true if delivered successfully, false otherwise
 */
export async function deliverWebhook(webhookLogId: string): Promise<boolean> {
  const webhook = await prisma.webhookLog.findUnique({
    where: { id: webhookLogId },
  });

  if (!webhook) {
    console.error('❌ Webhook not found:', webhookLogId);
    return false;
  }

  console.log('');
  console.log('🚀 Attempting to deliver webhook');
  console.log('   Webhook ID:', webhookLogId);
  console.log('   Project ID:', webhook.projectId);
  console.log('   Event Type:', webhook.eventType);
  console.log('   Target URL:', webhook.forwardedTo);
  console.log('   Attempt #:', webhook.attempts + 1);

  // Mark as processing
  await prisma.webhookLog.update({
    where: { id: webhookLogId },
    data: {
      status: 'processing',
      lastAttemptAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.forwardedTo, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-From': 'x-forwarder',
      },
      body: JSON.stringify(webhook.payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Success! Mark as delivered
      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'delivered',
          statusCode: response.status,
          deliveredAt: new Date(),
          errorMessage: null,
        },
      });

      console.log('   ✅ Webhook delivered successfully');
      console.log('   Status Code:', response.status);
      return true;
    } else {
      // HTTP error - requeue for retry
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      console.log('   ❌ Delivery failed:', errorMessage);

      await requeueFailedWebhook(webhookLogId, errorMessage);
      return false;
    }
  } catch (error: any) {
    // Network error or timeout - requeue for retry
    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout (30s)'
      : error.message || 'Unknown error';

    console.log('   ❌ Delivery failed:', errorMessage);

    await requeueFailedWebhook(webhookLogId, errorMessage);
    return false;
  }
}

/**
 * Requeue a failed webhook to the end of the queue
 * Maintains FIFO ordering by setting nextRetryAt to a future time
 *
 * @param webhookLogId - ID of the webhook log to requeue
 * @param errorMessage - Error message to store
 */
export async function requeueFailedWebhook(
  webhookLogId: string,
  errorMessage: string
) {
  // Calculate next retry time (30 seconds from now)
  const nextRetryAt = new Date(Date.now() + INITIAL_RETRY_DELAY_SECONDS * 1000);

  await prisma.webhookLog.update({
    where: { id: webhookLogId },
    data: {
      status: 'pending',
      errorMessage,
      nextRetryAt,
    },
  });

  console.log('   🔄 Webhook requeued for retry');
  console.log('   Next retry at:', nextRetryAt.toISOString());
}

/**
 * Process pending webhooks in the queue
 * Processes webhooks in FIFO order based on createdAt
 * Only processes webhooks that are ready for retry (nextRetryAt <= now or null)
 *
 * @param projectId - Optional project ID to filter by
 * @param limit - Maximum number of webhooks to process (default: 10)
 * @returns Number of webhooks processed
 */
export async function processWebhookQueue(
  projectId?: string,
  limit: number = 10
): Promise<number> {
  console.log('');
  console.log('================================================================================');
  console.log('🔄 PROCESSING WEBHOOK QUEUE');
  console.log('================================================================================');
  console.log('   Timestamp:', new Date().toISOString());
  if (projectId) {
    console.log('   Project ID:', projectId);
  } else {
    console.log('   Scope: All projects');
  }
  console.log('   Batch size:', limit);
  console.log('');

  // Get pending webhooks that are ready for retry
  // Order by createdAt to maintain FIFO
  const pendingWebhooks = await prisma.webhookLog.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      status: 'pending',
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: 'asc' }, // FIFO ordering
    take: limit,
  });

  console.log('📊 Found', pendingWebhooks.length, 'webhooks ready for processing');

  if (pendingWebhooks.length === 0) {
    console.log('   ℹ️  No webhooks to process');
    console.log('================================================================================');
    console.log('');
    return 0;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const webhook of pendingWebhooks) {
    const success = await deliverWebhook(webhook.id);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log('');
  console.log('📈 QUEUE PROCESSING SUMMARY');
  console.log('   Total processed:', pendingWebhooks.length);
  console.log('   ✅ Delivered:', successCount);
  console.log('   ❌ Failed (requeued):', failureCount);
  console.log('================================================================================');
  console.log('');

  return pendingWebhooks.length;
}
