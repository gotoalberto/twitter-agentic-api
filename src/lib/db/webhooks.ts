/**
 * Webhook Registration Management with Prisma
 *
 * Handles webhook registration operations per project in PostgreSQL
 */

import { prisma } from './prisma';
import type { WebhookRegistration } from '@/generated/prisma';

export interface WebhookRegistrationData {
  webhookId: string;
  url: string;
  subscribed: boolean;
}

/**
 * Save or update webhook registration for a project
 */
export async function saveWebhookRegistration(
  projectId: string,
  data: WebhookRegistrationData
): Promise<WebhookRegistration> {
  const webhook = await prisma.webhookRegistration.upsert({
    where: { webhookId: data.webhookId },
    update: {
      url: data.url,
      subscribed: data.subscribed,
    },
    create: {
      projectId,
      webhookId: data.webhookId,
      url: data.url,
      subscribed: data.subscribed,
    },
  });

  console.log('✅ Webhook registration saved for project:', projectId, '- Webhook ID:', data.webhookId);
  return webhook;
}

/**
 * Get webhook registration by webhook ID
 */
export async function getWebhookRegistrationById(webhookId: string): Promise<WebhookRegistration | null> {
  const webhook = await prisma.webhookRegistration.findUnique({
    where: { webhookId },
    include: {
      project: true,
    },
  });

  return webhook;
}

/**
 * Get webhook registrations by project ID
 */
export async function getWebhookRegistrationsByProjectId(projectId: string): Promise<WebhookRegistration[]> {
  const webhooks = await prisma.webhookRegistration.findMany({
    where: { projectId },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return webhooks;
}

/**
 * Delete webhook registration by webhook ID
 */
export async function deleteWebhookRegistration(webhookId: string): Promise<void> {
  await prisma.webhookRegistration.delete({
    where: { webhookId },
  });

  console.log('✅ Webhook registration deleted:', webhookId);
}

/**
 * Delete all webhook registrations for a project
 */
export async function deleteAllWebhookRegistrationsForProject(projectId: string): Promise<void> {
  await prisma.webhookRegistration.deleteMany({
    where: { projectId },
  });

  console.log('✅ All webhook registrations deleted for project:', projectId);
}

/**
 * Update webhook subscription status
 */
export async function updateWebhookSubscriptionStatus(
  webhookId: string,
  subscribed: boolean
): Promise<WebhookRegistration> {
  const webhook = await prisma.webhookRegistration.update({
    where: { webhookId },
    data: { subscribed },
  });

  console.log(`✅ Webhook ${subscribed ? 'subscribed' : 'unsubscribed'}:`, webhookId);
  return webhook;
}

/**
 * Get all webhook registrations
 */
export async function getAllWebhookRegistrations(): Promise<WebhookRegistration[]> {
  const webhooks = await prisma.webhookRegistration.findMany({
    include: {
      project: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return webhooks;
}
