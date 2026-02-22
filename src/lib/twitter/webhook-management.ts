/**
 * Twitter Webhook Management
 *
 * Handles webhook registration and deletion for TwitterApp entities.
 * Each TwitterApp can have one webhook registered with X API.
 */

import { prisma } from '@/lib/db/prisma';
import { TwitterApp } from '@/generated/prisma';

const WEBHOOK_ENV = process.env.TWITTER_WEBHOOK_ENV || 'production';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app';

/**
 * Register a webhook for a TwitterApp
 * @param appId - The TwitterApp ID
 * @returns The webhook registration result
 */
export async function registerWebhookForApp(appId: string): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  console.log('🔄 REGISTERING WEBHOOK FOR APP:', appId);

  try {
    // Get the app
    const app = await prisma.twitterApp.findUnique({
      where: { id: appId }
    });

    if (!app) {
      return { success: false, error: 'TwitterApp not found' };
    }

    if (!app.bearerToken) {
      return { success: false, error: 'TwitterApp missing Bearer Token' };
    }

    // Check if webhook already registered
    if (app.webhookId) {
      console.log('⚠️ Webhook already registered for app:', app.name);
      return { success: true, webhookId: app.webhookId };
    }

    // Construct webhook URL for this app
    const webhookUrl = `${BASE_URL}/api/webhooks/twitter/${appId}`;

    console.log('📡 Registering webhook URL:', webhookUrl);
    console.log('   Environment:', WEBHOOK_ENV);

    // Register webhook with X API v2
    const response = await fetch(`https://api.x.com/2/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${app.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        name: `${app.name}_webhook_${WEBHOOK_ENV}`,
        description: `Webhook for ${app.name} in ${WEBHOOK_ENV}`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Webhook registration failed:', data);
      return { success: false, error: data.detail || data.title || 'Registration failed' };
    }

    console.log('✅ Webhook registered successfully:', data);

    // Update app with webhook info
    await prisma.twitterApp.update({
      where: { id: appId },
      data: {
        webhookId: data.data.id,
        webhookUrl: webhookUrl,
        webhookValid: true,
        webhookCreatedAt: new Date()
      }
    });

    console.log('✅ TwitterApp updated with webhook info');

    return { success: true, webhookId: data.data.id };

  } catch (error: any) {
    console.error('❌ Error registering webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a webhook for a TwitterApp
 * @param appId - The TwitterApp ID
 * @returns The deletion result
 */
export async function deleteWebhookForApp(appId: string): Promise<{ success: boolean; error?: string }> {
  console.log('🗑️ DELETING WEBHOOK FOR APP:', appId);

  try {
    // Get the app
    const app = await prisma.twitterApp.findUnique({
      where: { id: appId }
    });

    if (!app) {
      return { success: false, error: 'TwitterApp not found' };
    }

    if (!app.webhookId) {
      console.log('⚠️ No webhook registered for app:', app.name);
      return { success: true };
    }

    if (!app.bearerToken) {
      return { success: false, error: 'TwitterApp missing Bearer Token' };
    }

    console.log('📡 Deleting webhook ID:', app.webhookId);

    // Delete webhook from X API v2
    const response = await fetch(`https://api.x.com/2/webhooks/${app.webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${app.bearerToken}`,
      }
    });

    if (!response.ok && response.status !== 404) {
      const data = await response.json();
      console.error('❌ Webhook deletion failed:', data);
      return { success: false, error: data.detail || data.title || 'Deletion failed' };
    }

    console.log('✅ Webhook deleted from X API');

    // Clear webhook info from app
    await prisma.twitterApp.update({
      where: { id: appId },
      data: {
        webhookId: null,
        webhookUrl: null,
        webhookValid: false,
        webhookCreatedAt: null
      }
    });

    console.log('✅ TwitterApp webhook info cleared');

    return { success: true };

  } catch (error: any) {
    console.error('❌ Error deleting webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh webhook registration for a TwitterApp
 * Deletes existing webhook and registers a new one
 * @param appId - The TwitterApp ID
 * @returns The refresh result
 */
export async function refreshWebhookForApp(appId: string): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  console.log('🔄 REFRESHING WEBHOOK FOR APP:', appId);

  // First delete existing webhook
  const deleteResult = await deleteWebhookForApp(appId);
  if (!deleteResult.success) {
    return { success: false, error: `Failed to delete old webhook: ${deleteResult.error}` };
  }

  // Then register new webhook
  const registerResult = await registerWebhookForApp(appId);
  return registerResult;
}

/**
 * Check webhook status for a TwitterApp
 * @param appId - The TwitterApp ID
 * @returns The webhook status
 */
export async function checkWebhookStatus(appId: string): Promise<{
  registered: boolean;
  valid: boolean;
  webhookId?: string;
  webhookUrl?: string;
  error?: string;
}> {
  try {
    const app = await prisma.twitterApp.findUnique({
      where: { id: appId }
    });

    if (!app) {
      return { registered: false, valid: false, error: 'TwitterApp not found' };
    }

    if (!app.webhookId) {
      return { registered: false, valid: false };
    }

    // TODO: Could add X API call to verify webhook still exists
    // For now, trust our database state

    return {
      registered: true,
      valid: app.webhookValid,
      webhookId: app.webhookId,
      webhookUrl: app.webhookUrl || undefined
    };

  } catch (error: any) {
    console.error('❌ Error checking webhook status:', error);
    return { registered: false, valid: false, error: error.message };
  }
}