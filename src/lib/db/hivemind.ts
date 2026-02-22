import prisma from '@/lib/db/prisma';
import type { HivemindUser, HivemindConfig } from '@/generated/prisma';

// ===== HIVEMIND CONFIG OPERATIONS =====

export async function getHivemindConfig() {
  return prisma.hivemindConfig.findFirst({
    include: {
      twitterApp: true
    }
  });
}

export async function createOrUpdateHivemindConfig(twitterAppId: string | null, enabled: boolean) {
  console.log('🔍 [START] createOrUpdateHivemindConfig called with:', {
    twitterAppId,
    twitterAppIdType: typeof twitterAppId,
    enabled,
    timestamp: new Date().toISOString()
  });

  // Normalize the input
  const normalizedAppId = (!twitterAppId || twitterAppId === '') ? null : twitterAppId;
  console.log('🔍 Normalized appId:', normalizedAppId);

  try {
    // First, check ALL existing configs (there should only be one)
    const allConfigs = await prisma.hivemindConfig.findMany({
      include: {
        twitterApp: true
      }
    });

    console.log('🔍 [DATABASE STATE] Found configs:', {
      count: allConfigs.length,
      configs: allConfigs.map(c => ({
        id: c.id,
        twitterAppId: c.twitterAppId,
        enabled: c.enabled,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    });

    // Check if the twitterAppId we're trying to set already exists
    if (normalizedAppId !== null) {
      const existingWithThisAppId = await prisma.hivemindConfig.findUnique({
        where: { twitterAppId: normalizedAppId }
      });

      console.log('🔍 [CONSTRAINT CHECK] Config with this twitterAppId:', {
        found: !!existingWithThisAppId,
        config: existingWithThisAppId ? {
          id: existingWithThisAppId.id,
          twitterAppId: existingWithThisAppId.twitterAppId
        } : null
      });
    }

    // Get the first (and should be only) config
    const existing = allConfigs[0];

    if (existing) {
      console.log('🔍 [UPDATE PATH] Working with existing config:', {
        id: existing.id,
        currentAppId: existing.twitterAppId,
        currentEnabled: existing.enabled,
        targetAppId: normalizedAppId,
        targetEnabled: enabled,
        needsAppIdChange: existing.twitterAppId !== normalizedAppId,
        needsEnabledChange: existing.enabled !== enabled
      });

      // If nothing is changing, just return the existing config
      if (existing.twitterAppId === normalizedAppId && existing.enabled === enabled) {
        console.log('✅ [NO-OP] No changes detected, returning existing config');
        return existing;
      }

      // If we're changing the twitterAppId
      if (existing.twitterAppId !== normalizedAppId) {
        console.log('🔍 [TWO-STEP UPDATE] Starting two-step update process');

        // Step 1: Clear the current twitterAppId if it's not already null
        if (existing.twitterAppId !== null) {
          console.log('🔍 [STEP 1] Setting twitterAppId to null first');
          try {
            const step1Result = await prisma.hivemindConfig.update({
              where: { id: existing.id },
              data: {
                twitterAppId: null,
                updatedAt: new Date()
              }
            });
            console.log('✅ [STEP 1] Successfully set to null:', {
              id: step1Result.id,
              twitterAppId: step1Result.twitterAppId
            });
          } catch (step1Error: any) {
            console.error('❌ [STEP 1 ERROR] Failed to set to null:', {
              error: step1Error.message,
              code: step1Error.code,
              meta: step1Error.meta
            });
            throw step1Error;
          }
        }

        // Step 2: Update with the new value
        console.log('🔍 [STEP 2] Updating with new values:', {
          twitterAppId: normalizedAppId,
          enabled
        });

        try {
          const step2Result = await prisma.hivemindConfig.update({
            where: { id: existing.id },
            data: {
              twitterAppId: normalizedAppId,
              enabled,
              updatedAt: new Date()
            },
            include: {
              twitterApp: true
            }
          });

          console.log('✅ [STEP 2] Successfully updated:', {
            id: step2Result.id,
            twitterAppId: step2Result.twitterAppId,
            enabled: step2Result.enabled
          });

          return step2Result;
        } catch (step2Error: any) {
          console.error('❌ [STEP 2 ERROR] Failed to update with new value:', {
            error: step2Error.message,
            code: step2Error.code,
            meta: step2Error.meta,
            attemptedValue: normalizedAppId
          });
          throw step2Error;
        }
      }

      // Only enabled is changing
      console.log('🔍 [SIMPLE UPDATE] Only updating enabled flag');
      const result = await prisma.hivemindConfig.update({
        where: { id: existing.id },
        data: {
          enabled,
          updatedAt: new Date()
        },
        include: {
          twitterApp: true
        }
      });

      console.log('✅ [SIMPLE UPDATE] Successfully updated enabled flag');
      return result;
    }

    // No existing config, create a new one
    console.log('🔍 [CREATE] Creating new HivemindConfig');
    const created = await prisma.hivemindConfig.create({
      data: {
        twitterAppId: normalizedAppId,
        enabled
      },
      include: {
        twitterApp: true
      }
    });

    console.log('✅ [CREATE] Successfully created new config:', {
      id: created.id,
      twitterAppId: created.twitterAppId,
      enabled: created.enabled
    });

    return created;
  } catch (error: any) {
    console.error('❌ [FATAL ERROR] Unhandled error in createOrUpdateHivemindConfig:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    throw error;
  }
}

// ===== HIVEMIND USER OPERATIONS =====

export async function createHivemindUser(data: {
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  // OAuth 1.0a credentials (legacy)
  accessToken: string;
  accessTokenSecret: string;
  // OAuth 2.0 credentials (new)
  oauth2AccessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}) {
  // Store tokens in plain text

  // Check if user already exists
  const existing = await prisma.hivemindUser.findUnique({
    where: { userId: data.userId }
  });

  if (existing) {
    // Update existing user
    return prisma.hivemindUser.update({
      where: { userId: data.userId },
      data: {
        username: data.username,
        displayName: data.displayName,
        profileImageUrl: data.profileImageUrl,
        // OAuth 1.0a fields
        accessToken: data.accessToken,
        accessTokenSecret: data.accessTokenSecret,
        // OAuth 2.0 fields
        oauth2AccessToken: data.oauth2AccessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        scope: data.scope,
        lastActiveAt: new Date(),
        isActive: true
      }
    });
  }

  // Create new user
  return prisma.hivemindUser.create({
    data: {
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      profileImageUrl: data.profileImageUrl,
      // OAuth 1.0a fields
      accessToken: data.accessToken,
      accessTokenSecret: data.accessTokenSecret,
      // OAuth 2.0 fields
      oauth2AccessToken: data.oauth2AccessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      scope: data.scope,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true
    }
  });
}

export async function getHivemindUserByUsername(username: string) {
  const user = await prisma.hivemindUser.findUnique({
    where: { username }
  });

  return user;
}

export async function getHivemindUserById(userId: string) {
  const user = await prisma.hivemindUser.findUnique({
    where: { userId }
  });

  return user;
}

export async function disconnectHivemindUser(userId: string) {
  return prisma.hivemindUser.update({
    where: { userId },
    data: {
      isActive: false,
      lastActiveAt: new Date()
    }
  });
}

export async function deleteHivemindUser(userId: string) {
  return prisma.hivemindUser.delete({
    where: { userId }
  });
}

export async function getAllHivemindUsers() {
  return prisma.hivemindUser.findMany({
    select: {
      id: true,
      userId: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      connectedAt: true,
      lastActiveAt: true,
      isActive: true
    },
    orderBy: {
      connectedAt: 'desc'
    }
  });
}

export async function getActiveHivemindUsers() {
  return prisma.hivemindUser.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      userId: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      connectedAt: true,
      lastActiveAt: true
    },
    orderBy: {
      connectedAt: 'desc'
    }
  });
}

export async function updateHivemindUserActivity(userId: string) {
  return prisma.hivemindUser.update({
    where: { userId },
    data: {
      lastActiveAt: new Date()
    }
  });
}

export async function getHivemindStats() {
  const [totalUsers, activeUsers] = await Promise.all([
    prisma.hivemindUser.count(),
    prisma.hivemindUser.count({
      where: { isActive: true }
    })
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers
  };
}