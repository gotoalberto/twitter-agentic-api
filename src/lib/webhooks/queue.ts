/**
 * Webhook Queue Management
 *
 * Implements immediate webhook delivery with automatic retries:
 * - Immediate delivery attempt when webhook is received
 * - Failed deliveries are queued for retry
 * - Automatic retry every 2 minutes via cron
 * - Infinite retries with FIFO ordering
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
 * Attempt immediate webhook delivery (used when webhook first arrives)
 * Saves the webhook log with appropriate status based on delivery result
 *
 * @param projectId - Project ID
 * @param eventType - Type of webhook event
 * @param payload - Full webhook payload from Twitter
 * @param forwardUrl - URL to forward the webhook to
 * @returns true if delivered successfully, false if failed (and queued for retry)
 */
export async function deliverWebhookImmediately(
  projectId: string,
  eventType: string,
  payload: any,
  forwardUrl: string
): Promise<boolean> {
  console.log('');
  console.log('🚀 IMMEDIATE WEBHOOK DELIVERY ATTEMPT');
  console.log('   Project ID:', projectId);
  console.log('   Event Type:', eventType);
  console.log('   Target URL:', forwardUrl);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-From': 'x-forwarder',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Capture response body
    let responseBody = null;
    let responseText = '';
    try {
      responseText = await response.text();
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch (e) {
      // If not JSON, store as plain text
      responseBody = { text: responseText, error: 'Not valid JSON' };
    }

    if (response.ok) {
      // Success! Save as delivered
      await prisma.webhookLog.create({
        data: {
          projectId,
          eventType,
          forwardedTo: forwardUrl,
          status: 'delivered',
          statusCode: response.status,
          payload,
          attempts: 1,
          lastAttemptAt: new Date(),
          deliveredAt: new Date(),
          responseBody,
        },
      });

      console.log('   ✅ Webhook delivered immediately');
      console.log('   Status Code:', response.status);
      console.log('   Duration:', `${duration}ms`);
      console.log('   Response:', JSON.stringify(responseBody));
      return true;
    } else {
      // HTTP error - save as pending for retry
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      console.log('   ❌ Immediate delivery failed:', errorMessage);
      console.log('   Duration:', `${duration}ms`);
      console.log('   Response:', JSON.stringify(responseBody));

      const nextRetryAt = new Date(Date.now() + INITIAL_RETRY_DELAY_SECONDS * 1000);

      await prisma.webhookLog.create({
        data: {
          projectId,
          eventType,
          forwardedTo: forwardUrl,
          status: 'pending',
          statusCode: response.status,
          payload,
          attempts: 1,
          lastAttemptAt: new Date(),
          nextRetryAt,
          errorMessage,
          responseBody,
        },
      });

      console.log('   🔄 Webhook queued for retry');
      console.log('   Next retry at:', nextRetryAt.toISOString());
      return false;
    }
  } catch (error: any) {
    // Network error or timeout - save as pending for retry
    const duration = Date.now() - startTime;
    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout (30s)'
      : error.message || 'Unknown error';

    console.log('   ❌ Immediate delivery failed:', errorMessage);
    console.log('   Duration:', `${duration}ms`);

    const nextRetryAt = new Date(Date.now() + INITIAL_RETRY_DELAY_SECONDS * 1000);

    await prisma.webhookLog.create({
      data: {
        projectId,
        eventType,
        forwardedTo: forwardUrl,
        status: 'pending',
        payload,
        attempts: 1,
        lastAttemptAt: new Date(),
        nextRetryAt,
        errorMessage,
      },
    });

    console.log('   🔄 Webhook queued for retry');
    console.log('   Next retry at:', nextRetryAt.toISOString());
    return false;
  }
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

    // Capture response body
    let responseBody = null;
    let responseText = '';
    try {
      responseText = await response.text();
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch (e) {
      // If not JSON, store as plain text
      responseBody = { text: responseText, error: 'Not valid JSON' };
    }

    if (response.ok) {
      // Success! Mark as delivered
      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'delivered',
          statusCode: response.status,
          deliveredAt: new Date(),
          errorMessage: null,
          responseBody,
        },
      });

      console.log('   ✅ Webhook delivered successfully');
      console.log('   Status Code:', response.status);
      console.log('   Response:', JSON.stringify(responseBody));
      return true;
    } else {
      // HTTP error - requeue for retry
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      console.log('   ❌ Delivery failed:', errorMessage);
      console.log('   Response:', JSON.stringify(responseBody));

      await requeueFailedWebhook(webhookLogId, errorMessage, response.status, responseBody);
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
 * @param statusCode - HTTP status code (optional)
 * @param responseBody - Response body from endpoint (optional)
 */
export async function requeueFailedWebhook(
  webhookLogId: string,
  errorMessage: string,
  statusCode?: number,
  responseBody?: any
) {
  // Calculate next retry time (30 seconds from now)
  const nextRetryAt = new Date(Date.now() + INITIAL_RETRY_DELAY_SECONDS * 1000);

  await prisma.webhookLog.update({
    where: { id: webhookLogId },
    data: {
      status: 'pending',
      errorMessage,
      nextRetryAt,
      ...(statusCode !== undefined && { statusCode }),
      ...(responseBody !== undefined && { responseBody }),
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
