import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { registerWebhookForApp, deleteWebhookForApp } from '@/lib/twitter/webhook-management';
import { getTwitterAppById } from '@/lib/db/twitter-apps';

/**
 * POST: Manually register webhook for a Twitter App
 * Useful when initial registration fails or needs to be retried
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { force = false } = await request.json().catch(() => ({ force: false }));

    console.log('📡 Manual webhook registration requested for app:', id);
    console.log('   Force re-register:', force);

    // Check if app exists
    const app = await getTwitterAppById(id);
    if (!app) {
      return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
    }

    // If force flag is set, delete existing webhook first
    if (force && app.webhookId) {
      console.log('🗑️ Force flag set, deleting existing webhook first...');
      const deleteResult = await deleteWebhookForApp(id);
      if (!deleteResult.success) {
        console.warn('⚠️ Failed to delete existing webhook:', deleteResult.error);
      }
    }

    // Register webhook
    console.log('🔄 Registering webhook for app:', app.name);
    const result = await registerWebhookForApp(id);

    if (result.success) {
      console.log('✅ Webhook registered successfully');
      return NextResponse.json({
        success: true,
        message: 'Webhook registered successfully',
        webhookId: result.webhookId,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app'}/api/webhooks/twitter/${id}`
      });
    } else {
      console.error('❌ Webhook registration failed:', result.error);

      // Check if it's a rate limit or temporary error
      if (result.error?.includes('high load') || result.error?.includes('temporary')) {
        return NextResponse.json({
          success: false,
          error: result.error,
          message: 'X API is experiencing temporary issues. Please try again in a few minutes.',
          retryable: true
        }, { status: 503 });
      }

      return NextResponse.json({
        success: false,
        error: result.error,
        message: 'Failed to register webhook'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Error in manual webhook registration:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to register webhook'
    }, { status: 500 });
  }
}

/**
 * DELETE: Manually delete webhook for a Twitter App
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

    console.log('🗑️ Manual webhook deletion requested for app:', id);

    const result = await deleteWebhookForApp(id);

    if (result.success) {
      console.log('✅ Webhook deleted successfully');
      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } else {
      console.error('❌ Webhook deletion failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
        message: 'Failed to delete webhook'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Error in manual webhook deletion:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to delete webhook'
    }, { status: 500 });
  }
}