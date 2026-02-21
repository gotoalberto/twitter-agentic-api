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
  consumerKey?: string;  // OAuth 1.0a - now optional
  consumerSecret?: string;  // OAuth 1.0a - now optional
  clientId?: string;  // OAuth 2.0 - optional
  clientSecret?: string;  // OAuth 2.0 - optional
  bearerToken: string;  // Always required for read-only operations
  webhookEnv?: string;
}

/**
 * Create a new Twitter App (credentials stored in plain text)
 * Supports both OAuth 1.0a and OAuth 2.0 credentials
 */
export async function createTwitterApp(data: TwitterAppInput): Promise<TwitterApp> {
  // Validate that at least one OAuth method is provided
  const hasOAuth1 = data.consumerKey && data.consumerSecret;
  const hasOAuth2 = data.clientId && data.clientSecret;

  if (!hasOAuth1 && !hasOAuth2) {
    throw new Error('You must provide either OAuth 1.0a credentials (Consumer Key/Secret) or OAuth 2.0 credentials (Client ID/Secret)');
  }

  const app = await prisma.twitterApp.create({
    data: {
      name: data.name,
      // OAuth 1.0a fields (now optional in schema)
      consumerKey: data.consumerKey || null,
      consumerSecret: data.consumerSecret || null,
      // OAuth 2.0 fields (optional)
      clientId: data.clientId || null,
      clientSecret: data.clientSecret || null,
      bearerToken: data.bearerToken,
      webhookEnv: data.webhookEnv || 'production',
    },
  });

  console.log('✅ Twitter App created:', app.name, `(${app.id})`);
  console.log('   OAuth 1.0a:', hasOAuth1 ? 'Configured' : 'Not configured');
  console.log('   OAuth 2.0:', hasOAuth2 ? 'Configured' : 'Not configured');
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
 * Supports both OAuth 1.0a and OAuth 2.0 credentials
 */
export async function updateTwitterApp(
  id: string,
  data: Partial<TwitterAppInput>
): Promise<TwitterApp> {
  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = data.name;

  // OAuth 1.0a fields - use null if empty (now optional in schema)
  if (data.consumerKey !== undefined) updateData.consumerKey = data.consumerKey || null;
  if (data.consumerSecret !== undefined) updateData.consumerSecret = data.consumerSecret || null;

  // OAuth 2.0 fields - use null if empty
  if (data.clientId !== undefined) updateData.clientId = data.clientId || null;
  if (data.clientSecret !== undefined) updateData.clientSecret = data.clientSecret || null;

  if (data.bearerToken !== undefined) updateData.bearerToken = data.bearerToken;
  if (data.webhookEnv !== undefined) updateData.webhookEnv = data.webhookEnv;

  // Validate that at least one OAuth method remains configured
  const existingApp = await prisma.twitterApp.findUnique({ where: { id } });
  if (!existingApp) throw new Error('Twitter App not found');

  const willHaveOAuth1 = (updateData.consumerKey ?? existingApp.consumerKey) &&
                         (updateData.consumerSecret ?? existingApp.consumerSecret);
  const willHaveOAuth2 = (updateData.clientId ?? existingApp.clientId) &&
                         (updateData.clientSecret ?? existingApp.clientSecret);

  if (!willHaveOAuth1 && !willHaveOAuth2) {
    throw new Error('You must provide either OAuth 1.0a credentials (Consumer Key/Secret) or OAuth 2.0 credentials (Client ID/Secret)');
  }

  const app = await prisma.twitterApp.update({
    where: { id },
    data: updateData,
  });

  console.log('✅ Twitter App updated:', app.name);
  console.log('   OAuth 1.0a:', app.consumerKey && app.consumerSecret ? 'Configured' : 'Not configured');
  console.log('   OAuth 2.0:', app.clientId && app.clientSecret ? 'Configured' : 'Not configured');
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
