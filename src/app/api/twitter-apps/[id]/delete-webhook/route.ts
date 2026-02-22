import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getTwitterAppById } from '@/lib/db/twitter-apps';
import { deleteWebhook, listWebhooks } from '@/lib/twitter/webhooks';
import { prisma } from '@/lib/db/prisma';

/**
 * DELETE: Remove webhook registration from Twitter and database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: twitterAppId } = await params;

    // Get TwitterApp
    const twitterApp = await getTwitterAppById(twitterAppId);
    if (!twitterApp) {
      return NextResponse.json(
        { error: 'Twitter App not found' },
        { status: 404 }
      );
    }

    console.log('🗑️ Deleting webhook for TwitterApp:', twitterApp.name);

    // Check if we have the necessary credentials
    if (!twitterApp.bearerToken || !twitterApp.consumerKey || !twitterApp.consumerSecret) {
      return NextResponse.json(
        { error: 'Twitter App missing required credentials' },
        { status: 400 }
      );
    }

    // Get the webhook URL we're looking for
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/twitter/${twitterAppId}`;
    console.log('📍 Looking for webhook URL:', webhookUrl);

    try {
      // List webhooks from Twitter
      const webhooks = await listWebhooks(
        twitterApp.bearerToken,
        twitterApp.webhookEnv
      );

      console.log(`📋 Found ${webhooks.length} webhook(s) in Twitter`);

      // Find our webhook
      const webhookToDelete = webhooks.find(w => w.url === webhookUrl);

      if (webhookToDelete) {
        console.log('🎯 Found webhook to delete:', webhookToDelete.id);

        // Delete from Twitter
        await deleteWebhook(
          webhookToDelete.id,
          twitterApp.consumerKey,
          twitterApp.consumerSecret,
          twitterApp.webhookEnv,
          twitterApp.bearerToken
        );

        console.log('✅ Webhook deleted from Twitter');
      } else {
        console.log('⚠️ Webhook not found in Twitter, may already be deleted');
      }

      // Delete webhook registrations from database
      const deletedWebhooks = await prisma.webhookRegistration.deleteMany({
        where: {
          OR: [
            { url: webhookUrl },
            { webhookId: webhookToDelete?.id }
          ]
        }
      });

      console.log(`🗑️ Deleted ${deletedWebhooks.count} webhook registration(s) from database`);

      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully',
        deletedFromTwitter: !!webhookToDelete,
        deletedFromDb: deletedWebhooks.count
      });

    } catch (twitterError: any) {
      console.error('❌ Error during webhook deletion:', twitterError);

      // Even if Twitter deletion fails, try to clean up database
      try {
        const deletedWebhooks = await prisma.webhookRegistration.deleteMany({
          where: { url: webhookUrl }
        });

        return NextResponse.json({
          success: true,
          message: 'Webhook cleaned from database (Twitter deletion may have failed)',
          deletedFromTwitter: false,
          deletedFromDb: deletedWebhooks.count,
          warning: twitterError.message
        });
      } catch (dbError: any) {
        console.error('❌ Database cleanup also failed:', dbError);
        throw twitterError;
      }
    }

  } catch (error: any) {
    console.error('❌ Delete webhook error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete webhook',
        details: error.message
      },
      { status: 500 }
    );
  }
}