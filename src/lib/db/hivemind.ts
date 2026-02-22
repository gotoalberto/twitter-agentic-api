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
  // First, try to find an existing config
  const existing = await prisma.hivemindConfig.findFirst({
    include: {
      twitterApp: true
    }
  });

  if (existing) {
    // If the twitterAppId is the same, we don't need to update it
    // This avoids the unique constraint error
    if (existing.twitterAppId === twitterAppId) {
      // Only update the enabled flag and updatedAt timestamp
      return prisma.hivemindConfig.update({
        where: { id: existing.id },
        data: {
          enabled,
          updatedAt: new Date()
        },
        include: {
          twitterApp: true
        }
      });
    } else {
      // twitterAppId is different, so we need to update it
      // First, let's check if another config exists with this twitterAppId
      if (twitterAppId !== null) {
        const conflictingConfig = await prisma.hivemindConfig.findUnique({
          where: { twitterAppId }
        });

        if (conflictingConfig && conflictingConfig.id !== existing.id) {
          // Another config already uses this twitterAppId
          throw new Error(`Twitter App ID ${twitterAppId} is already in use by another configuration`);
        }
      }

      // Safe to update both fields
      return prisma.hivemindConfig.update({
        where: { id: existing.id },
        data: {
          twitterAppId,
          enabled,
          updatedAt: new Date()
        },
        include: {
          twitterApp: true
        }
      });
    }
  }

  // No existing config, create a new one
  return prisma.hivemindConfig.create({
    data: {
      twitterAppId,
      enabled
    },
    include: {
      twitterApp: true
    }
  });
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