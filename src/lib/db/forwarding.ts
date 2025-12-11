/**
 * Forwarding Configuration Management with Prisma
 *
 * Handles forwarding config operations per project in PostgreSQL
 */

import { prisma } from './prisma';
import type { ForwardingConfig } from '@/generated/prisma';

export interface ForwardingConfigData {
  endpoint: string;
  enabled: boolean;
}

/**
 * Save or update forwarding configuration for a project
 */
export async function saveForwardingConfig(
  projectId: string,
  config: ForwardingConfigData
): Promise<ForwardingConfig> {
  const forwardingConfig = await prisma.forwardingConfig.upsert({
    where: { projectId },
    update: {
      endpoint: config.endpoint,
      enabled: config.enabled,
    },
    create: {
      projectId,
      endpoint: config.endpoint,
      enabled: config.enabled,
    },
  });

  console.log('✅ Forwarding config saved for project:', projectId, '- Endpoint:', config.endpoint);
  return forwardingConfig;
}

/**
 * Get forwarding configuration by project ID
 */
export async function getForwardingConfig(projectId: string): Promise<ForwardingConfig | null> {
  const config = await prisma.forwardingConfig.findUnique({
    where: { projectId },
  });

  return config;
}

/**
 * Delete forwarding configuration for a project
 */
export async function deleteForwardingConfig(projectId: string): Promise<void> {
  await prisma.forwardingConfig.delete({
    where: { projectId },
  });

  console.log('✅ Forwarding config deleted for project:', projectId);
}

/**
 * Get all forwarding configurations
 */
export async function getAllForwardingConfigs(): Promise<ForwardingConfig[]> {
  const configs = await prisma.forwardingConfig.findMany({
    include: {
      project: true,
    },
  });

  return configs;
}

/**
 * Enable/disable forwarding for a project
 */
export async function setForwardingEnabled(projectId: string, enabled: boolean): Promise<ForwardingConfig> {
  const config = await prisma.forwardingConfig.update({
    where: { projectId },
    data: { enabled },
  });

  console.log(`✅ Forwarding ${enabled ? 'enabled' : 'disabled'} for project:`, projectId);
  return config;
}
