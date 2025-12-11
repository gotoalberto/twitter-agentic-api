/**
 * Bot Management with Prisma
 *
 * Handles CRUD operations for bots in PostgreSQL
 * Maintains encryption for OAuth tokens
 */

import { prisma } from './prisma';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import type { Bot } from '@/generated/prisma';

export interface BotData {
  username: string;
  userId: string;
  accessToken: string;         // Unencrypted
  accessTokenSecret: string;   // Unencrypted
}

export interface DecryptedBot extends Omit<Bot, 'accessToken' | 'accessTokenSecret'> {
  accessToken: string;         // Decrypted
  accessTokenSecret: string;   // Decrypted
}

/**
 * Save bot for a project (creates or updates)
 */
export async function saveBot(projectId: string, botData: BotData): Promise<Bot> {
  // Encrypt tokens before saving
  const encryptedData = {
    username: botData.username,
    userId: botData.userId,
    accessToken: encrypt(botData.accessToken),
    accessTokenSecret: encrypt(botData.accessTokenSecret),
    projectId,
  };

  // Upsert: update if exists, create if not
  const bot = await prisma.bot.upsert({
    where: { projectId },
    update: encryptedData,
    create: encryptedData,
  });

  console.log('✅ Bot saved for project:', projectId, '- Username:', botData.username);
  return bot;
}

/**
 * Get bot by project ID with decrypted tokens
 */
export async function getBotByProjectId(projectId: string): Promise<DecryptedBot | null> {
  const bot = await prisma.bot.findUnique({
    where: { projectId },
  });

  if (!bot) {
    return null;
  }

  // Decrypt tokens
  return {
    ...bot,
    accessToken: decrypt(bot.accessToken),
    accessTokenSecret: decrypt(bot.accessTokenSecret),
  };
}

/**
 * Get bot by username with decrypted tokens
 */
export async function getBotByUsername(username: string): Promise<DecryptedBot | null> {
  const bot = await prisma.bot.findUnique({
    where: { username },
  });

  if (!bot) {
    return null;
  }

  // Decrypt tokens
  return {
    ...bot,
    accessToken: decrypt(bot.accessToken),
    accessTokenSecret: decrypt(bot.accessTokenSecret),
  };
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
