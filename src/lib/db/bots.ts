/**
 * Bot Management with Prisma
 *
 * Handles CRUD operations for bots in PostgreSQL
 * OAuth tokens are stored in plain text
 */

import { prisma } from './prisma';
import type { Bot } from '@/generated/prisma';

export interface BotData {
  username: string;
  userId: string;
  accessToken: string;
  accessTokenSecret: string;
  // OAuth 2.0 fields (optional for backward compatibility)
  oauth2AccessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

/**
 * Save bot for a project (creates or updates)
 */
export async function saveBot(projectId: string, botData: BotData): Promise<Bot> {
  // Store tokens in plain text
  const data = {
    username: botData.username,
    userId: botData.userId,
    accessToken: botData.accessToken,
    accessTokenSecret: botData.accessTokenSecret,
    projectId,
    // OAuth 2.0 fields (optional)
    ...(botData.oauth2AccessToken && { oauth2AccessToken: botData.oauth2AccessToken }),
    ...(botData.refreshToken && { refreshToken: botData.refreshToken }),
    ...(botData.expiresAt && { expiresAt: botData.expiresAt }),
    ...(botData.scope && { scope: botData.scope }),
  };

  // Upsert: update if exists, create if not
  const bot = await prisma.bot.upsert({
    where: { projectId },
    update: data,
    create: data,
  });

  console.log('✅ Bot saved for project:', projectId, '- Username:', botData.username);
  return bot;
}

/**
 * Get bot by project ID (tokens in plain text)
 */
export async function getBotByProjectId(projectId: string): Promise<Bot | null> {
  const bot = await prisma.bot.findUnique({
    where: { projectId },
  });

  return bot;
}

/**
 * Get bot by username (tokens in plain text)
 */
export async function getBotByUsername(username: string): Promise<Bot | null> {
  const bot = await prisma.bot.findUnique({
    where: { username },
  });

  return bot;
}

/**
 * Delete bot by project ID
 */
export async function deleteBotByProjectId(projectId: string): Promise<void> {
  await prisma.bot.delete({
    where: { projectId },
  });

  console.log('✅ Bot deleted for project:', projectId);
}

/**
 * Check if a bot exists for a project
 */
export async function hasBotForProject(projectId: string): Promise<boolean> {
  const count = await prisma.bot.count({
    where: { projectId },
  });

  return count > 0;
}

/**
 * Get all bots (for admin purposes)
 */
export async function getAllBots(): Promise<Bot[]> {
  const bots = await prisma.bot.findMany({
    include: {
      project: true,
    },
  });

  return bots;
}