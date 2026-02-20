import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAdmin } from '@/lib/utils/admin';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';

/**
 * GET: Retrieve current Hivemind API key (masked)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.user.username || !isAdmin(session.user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await prisma.hivemindConfig.findFirst();

    if (!config || !config.apiKey) {
      return NextResponse.json({ apiKey: null });
    }

    // Mask the API key (show first 8 and last 4 characters)
    const masked = config.apiKey.substring(0, 8) +
                  '...' +
                  config.apiKey.substring(config.apiKey.length - 4);

    return NextResponse.json({
      apiKey: masked,
      full: false
    });

  } catch (error) {
    console.error('Error getting Hivemind API key:', error);
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    );
  }
}

/**
 * POST: Generate or regenerate Hivemind API key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.user.username || !isAdmin(session.user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate new API key with prefix
    const apiKey = 'hm_' + nanoid(32);

    // Update or create Hivemind config with new API key
    const config = await prisma.hivemindConfig.upsert({
      where: { id: 'hivemind-config-singleton' },
      update: { apiKey },
      create: {
        id: 'hivemind-config-singleton',
        apiKey,
        enabled: false
      }
    });

    console.log('✅ Hivemind API key generated');

    return NextResponse.json({
      apiKey,
      full: true,
      message: 'New API key generated successfully. Save this key - it will only be shown once in full.'
    });

  } catch (error) {
    console.error('Error generating Hivemind API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove Hivemind API key
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!session.user.username || !isAdmin(session.user.username)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await prisma.hivemindConfig.findFirst();

    if (!config) {
      return NextResponse.json({ error: 'Hivemind not configured' }, { status: 404 });
    }

    // Remove API key
    await prisma.hivemindConfig.update({
      where: { id: config.id },
      data: { apiKey: null }
    });

    console.log('✅ Hivemind API key removed');

    return NextResponse.json({
      success: true,
      message: 'API key removed successfully'
    });

  } catch (error) {
    console.error('Error removing Hivemind API key:', error);
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    );
  }
}