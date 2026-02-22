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
    enabled,
    timestamp: new Date().toISOString()
  });

  // Normalize the input
  const normalizedAppId = (!twitterAppId || twitterAppId === '') ? null : twitterAppId;

  try {
    // Get the SINGLE config (HivemindConfig is a singleton)
    const existing = await prisma.hivemindConfig.findFirst({
      include: {
        twitterApp: true
      }
    });

    if (existing) {
      console.log('🔍 [UPDATE] Existing config found:', {
        id: existing.id,
        currentAppId: existing.twitterAppId,
        currentEnabled: existing.enabled,
        targetAppId: normalizedAppId,
        targetEnabled: enabled
      });

      // If nothing is changing, return early
      if (existing.twitterAppId === normalizedAppId && existing.enabled === enabled) {
        console.log('✅ [NO-OP] No changes detected');
        return existing;
      }

      // Use transaction for atomic updates
      const updated = await prisma.$transaction(async (tx) => {
        // If we need to change twitterAppId, first clear it
        if (existing.twitterAppId !== normalizedAppId && existing.twitterAppId !== null) {
          console.log('🔍 [CLEAR] Clearing existing twitterAppId');
          await tx.hivemindConfig.update({
            where: { id: existing.id },
            data: { twitterAppId: null }
          });
        }

        // Now update with the new values
        console.log('🔍 [UPDATE] Applying new values');
        return await tx.hivemindConfig.update({
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
      });

      console.log('✅ [SUCCESS] Config updated:', {
        id: updated.id,
        twitterAppId: updated.twitterAppId,
        enabled: updated.enabled
      });

      return updated;
    }

    // No config exists, create the singleton
    console.log('🔍 [CREATE] Creating singleton HivemindConfig');
    const created = await prisma.hivemindConfig.create({
      data: {
        twitterAppId: normalizedAppId,
        enabled
      },
      include: {
        twitterApp: true
      }
    });

    console.log('✅ [SUCCESS] Config created:', {
      id: created.id,
      twitterAppId: created.twitterAppId,
      enabled: created.enabled
    });

    return created;
  } catch (error: any) {
    console.error('❌ [ERROR] createOrUpdateHivemindConfig failed:', {
      message: error.message,
      code: error.code,
      meta: error.meta
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