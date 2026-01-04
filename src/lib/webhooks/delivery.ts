/**
 * Webhook Delivery System - Multi-Endpoint Support
 *
 * This module handles delivering webhooks to multiple endpoints per project.
 * Key features:
 * - Immediate delivery attempts when webhook arrives
 * - Automatic retry with 30s delay for failed deliveries
 * - "Paused" status for disabled endpoints (webhooks saved for later replay)
 * - FIFO queue ordering
 * - Endpoint-specific delivery tracking
 */

import { prisma } from '@/lib/db/prisma';

// Configuration
const RETRY_DELAY_SECONDS = 30;
const WEBHOOK_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Deliver webhook to a specific endpoint immediately
 *
 * If endpoint is enabled: attempts immediate delivery
 * If endpoint is disabled: saves webhook with status "paused" for later replay
 *
 * @param projectId - Project ID
 * @param endpointId - Endpoint ID
 * @param eventType - Event type (e.g., "tweet_create_events")
 * @param payload - Full webhook payload
 * @returns true if delivered successfully, false otherwise
 */
export async function deliverToEndpoint(
  projectId: string,
  endpointId: string,
  eventType: string,
  payload: any
): Promise<boolean> {
  // Get the endpoint
  const endpoint = await prisma.forwardingEndpoint.findUnique({
    where: { id: endpointId }
  });

  if (!endpoint) {
    console.error('❌ Endpoint not found:', endpointId);
    return false;
  }

  // If disabled, save as "paused" for later replay
  if (!endpoint.enabled) {
    console.log('⏸️  Endpoint disabled, saving webhook as PAUSED');
    console.log('   Endpoint:', endpoint.name);
    console.log('   URL:', endpoint.url);

    await prisma.webhookDelivery.create({
      data: {
        projectId,
        endpointId,
        eventType,
        payload,
        status: 'paused',
        attempts: 0,
      }
    });

    return false;
  }

  // Attempt immediate delivery
  console.log('🚀 IMMEDIATE DELIVERY ATTEMPT');
  console.log('   Endpoint:', endpoint.name);
  console.log('   URL:', endpoint.url);
  console.log('   Event Type:', eventType);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
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
    try {
      const text = await response.text();
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = { error: 'Invalid JSON response' };
    }

    if (response.ok) {
      // ✅ Success - save as delivered
      await prisma.webhookDelivery.create({
        data: {
          projectId,
          endpointId,
          eventType,
          payload,
          status: 'delivered',
          statusCode: response.status,
          attempts: 1,
          lastAttemptAt: new Date(),
          deliveredAt: new Date(),
          responseBody,
        }
      });

      console.log('   ✅ Delivered successfully');
      console.log('   Status Code:', response.status);
      console.log('   Duration:', `${duration}ms`);
      return true;
    } else {
      // ❌ HTTP error - save for retry
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      const nextRetryAt = new Date(Date.now() + RETRY_DELAY_SECONDS * 1000);

      await prisma.webhookDelivery.create({
        data: {
          projectId,
          endpointId,
          eventType,
          payload,
          status: 'pending',
          statusCode: response.status,
          attempts: 1,
          lastAttemptAt: new Date(),
          nextRetryAt,
          errorMessage,
          responseBody,
        }
      });

      console.log('   ❌ Delivery failed:', errorMessage);
      console.log('   Duration:', `${duration}ms`);
      console.log('   🔄 Queued for retry at:', nextRetryAt.toISOString());
      return false;
    }
  } catch (error: any) {
    // ❌ Network error or timeout
    const duration = Date.now() - startTime;
    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout (30s)'
      : error.message || 'Unknown error';

    const nextRetryAt = new Date(Date.now() + RETRY_DELAY_SECONDS * 1000);

    await prisma.webhookDelivery.create({
      data: {
        projectId,
        endpointId,
        eventType,
        payload,
        status: 'pending',
        attempts: 1,
        lastAttemptAt: new Date(),
        nextRetryAt,
        errorMessage,
      }
    });

    console.log('   ❌ Delivery failed:', errorMessage);
    console.log('   Duration:', `${duration}ms`);
    console.log('   🔄 Queued for retry at:', nextRetryAt.toISOString());
    return false;
  }
}

/**
 * Deliver webhook to ALL endpoints of a project
 * Processes endpoints in parallel for efficiency
 *
 * @param projectId - Project ID
 * @param eventType - Event type
 * @param payload - Webhook payload
 */
export async function deliverToAllEndpoints(
  projectId: string,
  eventType: string,
  payload: any
): Promise<void> {
  // Get all endpoints for this project, ordered by priority
  const endpoints = await prisma.forwardingEndpoint.findMany({
    where: { projectId },
    orderBy: { priority: 'asc' }
  });

  if (endpoints.length === 0) {
    console.log('⚠️  No endpoints configured for this project');
    return;
  }

  console.log(`📡 Delivering webhook to ${endpoints.length} endpoint(s)`);

  // Deliver to all endpoints in parallel
  await Promise.all(
    endpoints.map(endpoint =>
      deliverToEndpoint(projectId, endpoint.id, eventType, payload)
    )
  );
}

/**
 * Retry delivery of a specific webhook
 * Called by the queue processor for failed deliveries
 *
 * @param deliveryId - Webhook delivery ID
 * @returns true if delivered successfully, false otherwise
 */
export async function retryDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true }
  });

  if (!delivery) {
    console.error('❌ Delivery not found:', deliveryId);
    return false;
  }

  // If endpoint was disabled, pause the delivery
  if (!delivery.endpoint.enabled) {
    console.log('⏸️  Endpoint disabled, pausing delivery');
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'paused' }
    });
    return false;
  }

  console.log('');
  console.log('🚀 RETRYING DELIVERY');
  console.log('   Delivery ID:', deliveryId);
  console.log('   Endpoint:', delivery.endpoint.name);
  console.log('   Attempt #:', delivery.attempts + 1);

  // Mark as processing
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'processing',
      lastAttemptAt: new Date(),
      attempts: { increment: 1 }
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-From': 'x-forwarder',
      },
      body: JSON.stringify(delivery.payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseBody = null;
    try {
      const text = await response.text();
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = { error: 'Invalid JSON response' };
    }

    if (response.ok) {
      // ✅ Success
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          statusCode: response.status,
          deliveredAt: new Date(),
          errorMessage: null,
          responseBody,
        }
      });

      console.log('   ✅ Delivered successfully');
      console.log('   Status Code:', response.status);
      return true;
    } else {
      // ❌ HTTP error - requeue
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      await requeueFailedDelivery(deliveryId, errorMessage, response.status, responseBody);
      return false;
    }
  } catch (error: any) {
    // ❌ Network error - requeue
    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout (30s)'
      : error.message || 'Unknown error';

    await requeueFailedDelivery(deliveryId, errorMessage);
    return false;
  }
}

/**
 * Requeue a failed delivery for retry
 *
 * @param deliveryId - Delivery ID
 * @param errorMessage - Error message
 * @param statusCode - HTTP status code (optional)
 * @param responseBody - Response body (optional)
 */
async function requeueFailedDelivery(
  deliveryId: string,
  errorMessage: string,
  statusCode?: number,
  responseBody?: any
) {
  const nextRetryAt = new Date(Date.now() + RETRY_DELAY_SECONDS * 1000);

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      errorMessage,
      nextRetryAt,
      ...(statusCode !== undefined && { statusCode }),
      ...(responseBody !== undefined && { responseBody }),
    }
  });

  console.log('   ❌ Delivery failed:', errorMessage);
  console.log('   🔄 Requeued for retry at:', nextRetryAt.toISOString());
}

/**
 * Process pending webhook deliveries queue
 * Finds deliveries ready for retry and attempts to deliver them
 *
 * @param projectId - Optional: filter by project
 * @param endpointId - Optional: filter by endpoint
 * @param limit - Maximum number of deliveries to process (default: 10)
 * @returns Number of deliveries processed
 */
export async function processDeliveryQueue(
  projectId?: string,
  endpointId?: string,
  limit: number = 10
): Promise<number> {
  console.log('');
  console.log('================================================================================');
  console.log('🔄 PROCESSING DELIVERY QUEUE');
  console.log('================================================================================');
  console.log('   Timestamp:', new Date().toISOString());
  if (projectId) console.log('   Project ID:', projectId);
  if (endpointId) console.log('   Endpoint ID:', endpointId);
  console.log('   Batch size:', limit);
  console.log('');

  // Find pending deliveries ready for retry
  const pending = await prisma.webhookDelivery.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(endpointId && { endpointId }),
      status: 'pending',
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' }, // FIFO ordering
    take: limit
  });

  console.log(`📊 Found ${pending.length} deliveries ready for processing`);

  if (pending.length === 0) {
    console.log('   ℹ️  No deliveries to process');
    console.log('================================================================================');
    console.log('');
    return 0;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const delivery of pending) {
    const success = await retryDelivery(delivery.id);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log('');
  console.log('📈 QUEUE PROCESSING SUMMARY');
  console.log('   Total processed:', pending.length);
  console.log('   ✅ Delivered:', successCount);
  console.log('   ❌ Failed (requeued):', failureCount);
  console.log('================================================================================');
  console.log('');

  return pending.length;
}

/**
 * Resume paused deliveries for an endpoint
 * Called when an endpoint is re-enabled
 * Changes status from "paused" to "pending" and triggers immediate processing
 *
 * @param endpointId - Endpoint ID
 * @returns Number of deliveries resumed
 */
export async function resumePausedDeliveries(endpointId: string): Promise<number> {
  console.log('');
  console.log('▶️  RESUMING PAUSED DELIVERIES');
  console.log('   Endpoint ID:', endpointId);

  // Change status from "paused" to "pending"
  const result = await prisma.webhookDelivery.updateMany({
    where: {
      endpointId,
      status: 'paused'
    },
    data: {
      status: 'pending',
      nextRetryAt: new Date() // Process immediately
    }
  });

  console.log(`   ✅ ${result.count} deliveries resumed`);

  // Trigger immediate processing
  if (result.count > 0) {
    console.log('   🔄 Starting immediate processing...');
    await processDeliveryQueue(undefined, endpointId, 50);
  }

  return result.count;
}
