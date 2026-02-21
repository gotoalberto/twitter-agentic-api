/**
 * Twitter App Management with Prisma
 *
 * Handles CRUD operations for Twitter Apps in PostgreSQL.
 * Credentials are stored in plain text.
 */

import { prisma } from './prisma';
import type { TwitterApp } from '@/generated/prisma';

export interface TwitterAppInput {
  name: string;
  consumerKey: string;
  consumerSecret: string;
  bearerToken: string;
  webhookEnv?: string;
}

/**
 * Create a new Twitter App (credentials stored in plain text)
 */
export async function createTwitterApp(data: TwitterAppInput): Promise<TwitterApp> {
  const app = await prisma.twitterApp.create({
    data: {
      name: data.name,
      consumerKey: data.consumerKey,
      consumerSecret: data.consumerSecret,
      bearerToken: data.bearerToken,
      webhookEnv: data.webhookEnv || 'production',
    },
  });

  console.log('✅ Twitter App created:', app.name, `(${app.id})`);
  return app;
}

/**
 * Get all Twitter Apps
 */
export async function getAllTwitterApps(): Promise<(TwitterApp & { _count: { projects: number } })[]> {
  const apps = await prisma.twitterApp.findMany({
    include: {
      _count: {
        select: { projects: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return apps;
}

/**
 * Get a Twitter App by ID (credentials in plain text)
 */
export async function getTwitterAppById(id: string): Promise<TwitterApp | null> {
  const app = await prisma.twitterApp.findUnique({
    where: { id },
  });

  return app;
}

/**
 * Get a Twitter App by ID without decrypting credentials (for listings)
 */
export async function getTwitterAppByIdRaw(id: string): Promise<TwitterApp | null> {
  return prisma.twitterApp.findUnique({
    where: { id },
  });
}

/**
 * Get the TwitterApp associated with a project (credentials in plain text)
 */
export async function getTwitterAppByProjectId(projectId: string): Promise<TwitterApp | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { twitterApp: true },
  });

  if (!project?.twitterApp) return null;

  return project.twitterApp;
}

/**
 * Update a Twitter App (credentials stored in plain text)
 */
export async function updateTwitterApp(
  id: string,
  data: Partial<TwitterAppInput>
): Promise<TwitterApp> {
  const updateData: Record<string, string> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.consumerKey !== undefined) updateData.consumerKey = data.consumerKey;
  if (data.consumerSecret !== undefined) updateData.consumerSecret = data.consumerSecret;
  if (data.bearerToken !== undefined) updateData.bearerToken = data.bearerToken;
  if (data.webhookEnv !== undefined) updateData.webhookEnv = data.webhookEnv;

  const app = await prisma.twitterApp.update({
    where: { id },
    data: updateData,
  });

  console.log('✅ Twitter App updated:', app.name);
  return app;
}

/**
 * Delete a Twitter App
 * Fails if any project is still associated with it
 */
export async function deleteTwitterApp(id: string): Promise<void> {
  const projectCount = await prisma.project.count({
    where: { twitterAppId: id },
  });

  if (projectCount > 0) {
    throw new Error(
      `Cannot delete Twitter App: ${projectCount} project(s) are still using it. Reassign them first.`
    );
  }

  await prisma.twitterApp.delete({
    where: { id },
  });

  console.log('✅ Twitter App deleted:', id);
}
