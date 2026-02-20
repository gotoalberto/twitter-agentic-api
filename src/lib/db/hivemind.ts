import prisma from '@/lib/db/prisma';
import { encrypt, decrypt } from '@/lib/utils/encryption';
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
  const existing = await prisma.hivemindConfig.findFirst();

  if (existing) {
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
  accessToken: string;
  accessTokenSecret: string;
}) {
  // Encrypt tokens before storing
  const encryptedAccessToken = encrypt(data.accessToken);
  const encryptedAccessTokenSecret = encrypt(data.accessTokenSecret);

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
        accessToken: encryptedAccessToken,
        accessTokenSecret: encryptedAccessTokenSecret,
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
      accessToken: encryptedAccessToken,
      accessTokenSecret: encryptedAccessTokenSecret,
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

  if (!user) {
    return null;
  }

  // Decrypt tokens before returning
  return {
    ...user,
    accessToken: decrypt(user.accessToken),
    accessTokenSecret: decrypt(user.accessTokenSecret)
  };
}

export async function getHivemindUserById(userId: string) {
  const user = await prisma.hivemindUser.findUnique({
    where: { userId }
  });

  if (!user) {
    return null;
  }

  // Decrypt tokens before returning
  return {
    ...user,
    accessToken: decrypt(user.accessToken),
    accessTokenSecret: decrypt(user.accessTokenSecret)
  };
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