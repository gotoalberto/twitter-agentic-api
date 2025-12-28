import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById, deleteProject } from '@/lib/db/projects';
import { unsubscribeWebhook, deleteWebhook } from '@/lib/twitter/webhooks';
import { getBotByProjectId } from '@/lib/db/bots';
import { getWebhookRegistrationsByProjectId, deleteAllWebhookRegistrationsForProject } from '@/lib/db/webhooks';

/**
 * GET: Get a specific project with all its data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error getting project:', error);
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a project and clean up all its resources
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log('');
    console.log('=== PROJECT DELETION STARTED ===');
    console.log('🗑️  Deleting project:', project.name, `(${project.id})`);

    // Clean up webhooks if bot is connected
    let bot = null;
    try {
      bot = await getBotByProjectId(id);
      const webhooks = await getWebhookRegistrationsByProjectId(id);
      const subscribedWebhook = webhooks.find(w => w.subscribed);

      if (subscribedWebhook && bot) {
        console.log('📍 Cleaning up webhooks...');

        const bearerToken = process.env.X_API_BEARER_TOKEN;

        if (bearerToken) {
          // Unsubscribe bot using Bearer Token (updated to use correct endpoint)
          await unsubscribeWebhook(
            subscribedWebhook.webhookId,
            bot.userId,
            bearerToken
          );
          console.log('✅ Bot unsubscribed from webhook');

          // Delete webhook from Twitter
          await deleteWebhook(subscribedWebhook.webhookId, bearerToken);
          console.log('✅ Webhook deleted from Twitter');
        } else {
          console.error('❌ X_API_BEARER_TOKEN not found - cannot clean up webhook subscription');
          throw new Error('Bearer token not configured');
        }

        // Delete webhook registrations from database
        await deleteAllWebhookRegistrationsForProject(id);
        console.log('✅ Webhook registrations deleted from database');
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
      console.error('   This may leave an orphaned subscription in Twitter');
      if (bot) {
        console.error('   You can manually clean it up using: node scripts/delete-orphaned-subscriptions.mjs', bot.userId);
      }
      // Continue anyway - project will still be deleted
    }

    // Delete project (cascades to bot, forwarding config, and webhook registrations)
    await deleteProject(id);

    console.log('✅ Project deleted successfully');
    console.log('=== PROJECT DELETION FINISHED ===');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
