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
    try {
      const bot = await getBotByProjectId(id);
      const webhooks = await getWebhookRegistrationsByProjectId(id);
      const subscribedWebhook = webhooks.find(w => w.subscribed);

      if (subscribedWebhook && bot) {
        console.log('📍 Cleaning up webhooks...');

        const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
        const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;
        const bearerToken = process.env.X_API_BEARER_TOKEN;

        if (consumerKey && consumerSecret) {
          // Unsubscribe bot
          await unsubscribeWebhook(
            consumerKey,
            consumerSecret,
            bot.accessToken,
            bot.accessTokenSecret,
            subscribedWebhook.webhookId
          );
          console.log('✅ Bot unsubscribed from webhook');

          // Delete webhook from Twitter
          if (bearerToken) {
            await deleteWebhook(subscribedWebhook.webhookId, bearerToken);
            console.log('✅ Webhook deleted from Twitter');
          }
        }

        // Delete webhook registrations from database
        await deleteAllWebhookRegistrationsForProject(id);
        console.log('✅ Webhook registrations deleted from database');
      }
    } catch (webhookError: any) {
      console.error('⚠️  Webhook cleanup failed (non-fatal):', webhookError.message);
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
