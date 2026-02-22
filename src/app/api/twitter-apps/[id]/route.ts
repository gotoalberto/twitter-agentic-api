import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getTwitterAppById,
  updateTwitterApp,
  deleteTwitterApp,
} from '@/lib/db/twitter-apps';
import { prisma } from '@/lib/db/prisma';
import { deleteWebhookForApp, registerWebhookForApp } from '@/lib/twitter/webhook-management';

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
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        bearerToken: app.bearerToken,
        webhookEnv: app.webhookEnv,
        webhookId: app.webhookId,
        webhookUrl: app.webhookUrl,
        webhookValid: app.webhookValid,
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
 * Supports both OAuth 1.0a and OAuth 2.0 credentials
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

    // Validate that at least one OAuth method will remain configured
    const hasOAuth1 = (body.consumerKey?.trim() || undefined) && (body.consumerSecret?.trim() || undefined);
    const hasOAuth2 = (body.clientId?.trim() || undefined) && (body.clientSecret?.trim() || undefined);

    // If both are explicitly set to empty, reject
    if (body.consumerKey === '' && body.consumerSecret === '' && body.clientId === '' && body.clientSecret === '') {
      return NextResponse.json({
        error: 'You must provide either OAuth 1.0a credentials (Consumer Key/Secret) or OAuth 2.0 credentials (Client ID/Secret)'
      }, { status: 400 });
    }

    // Only update provided fields
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.consumerKey !== undefined) updateData.consumerKey = body.consumerKey.trim() || undefined;
    if (body.consumerSecret !== undefined) updateData.consumerSecret = body.consumerSecret.trim() || undefined;
    if (body.clientId !== undefined) updateData.clientId = body.clientId.trim() || undefined;
    if (body.clientSecret !== undefined) updateData.clientSecret = body.clientSecret.trim() || undefined;
    if (body.bearerToken !== undefined) updateData.bearerToken = body.bearerToken.trim();
    if (body.webhookEnv !== undefined) updateData.webhookEnv = body.webhookEnv.trim();

    const app = await updateTwitterApp(id, updateData);

    // If bearer token was updated, try to re-register webhook
    if (body.bearerToken !== undefined && body.bearerToken.trim() !== '') {
      console.log('🔄 Bearer token updated, re-registering webhook...');
      const webhookResult = await registerWebhookForApp(id);

      if (webhookResult.success) {
        console.log('✅ Webhook re-registered successfully');
      } else {
        console.warn('⚠️ Webhook re-registration failed:', webhookResult.error);
      }
    }

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        webhookEnv: app.webhookEnv,
        webhookId: app.webhookId,
        webhookValid: app.webhookValid,
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

    // Delete webhook from X API before deleting the app
    console.log('🗑️ Deleting webhook for TwitterApp before deletion:', id);
    const webhookResult = await deleteWebhookForApp(id);

    if (webhookResult.success) {
      console.log('✅ Webhook deleted successfully');
    } else {
      console.warn('⚠️ Webhook deletion failed:', webhookResult.error);
      // Continue with app deletion anyway
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
