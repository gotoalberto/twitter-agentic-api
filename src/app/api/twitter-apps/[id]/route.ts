import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getTwitterAppById,
  updateTwitterApp,
  deleteTwitterApp,
} from '@/lib/db/twitter-apps';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: Get a single Twitter App with decrypted credentials (for editing)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const app = await getTwitterAppById(id);

    if (!app) {
      return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
    }

    // Return full data (including decrypted credentials) for editing
    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        consumerKey: app.consumerKey,
        consumerSecret: app.consumerSecret,
        bearerToken: app.bearerToken,
        webhookEnv: app.webhookEnv,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error getting Twitter App:', error);
    return NextResponse.json({ error: 'Failed to get Twitter App' }, { status: 500 });
  }
}

/**
 * PUT: Update a Twitter App
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only update provided fields
    const updateData: Record<string, string> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.consumerKey !== undefined) updateData.consumerKey = body.consumerKey.trim();
    if (body.consumerSecret !== undefined) updateData.consumerSecret = body.consumerSecret.trim();
    if (body.bearerToken !== undefined) updateData.bearerToken = body.bearerToken.trim();
    if (body.webhookEnv !== undefined) updateData.webhookEnv = body.webhookEnv.trim();

    const app = await updateTwitterApp(id, updateData);

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        webhookEnv: app.webhookEnv,
        updatedAt: app.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating Twitter App:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A Twitter App with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update Twitter App' }, { status: 500 });
  }
}

/**
 * DELETE: Delete a Twitter App
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check project count before deleting
    const projectCount = await prisma.project.count({ where: { twitterAppId: id } });
    if (projectCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${projectCount} project(s) are still using this app. Reassign them first.` },
        { status: 409 }
      );
    }

    await deleteTwitterApp(id);

    return NextResponse.json({ success: true, message: 'Twitter App deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting Twitter App:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to delete Twitter App' }, { status: 500 });
  }
}
