import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check admin secret
    const { adminSecret, newApiKey } = await request.json();

    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!newApiKey) {
      return NextResponse.json(
        { error: 'newApiKey is required' },
        { status: 400 }
      );
    }

    // Update Hivemind API key
    const hivemindConfig = await prisma.hivemindConfig.findFirst();

    if (!hivemindConfig) {
      return NextResponse.json(
        { error: 'Hivemind config not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.hivemindConfig.update({
      where: { id: hivemindConfig.id },
      data: { apiKey: newApiKey }
    });

    return NextResponse.json({
      success: true,
      message: 'Hivemind API key updated successfully',
      apiKey: updated.apiKey
    });

  } catch (error: any) {
    console.error('Error updating Hivemind API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}