import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { createBearerToken, verifyBearerToken } from '@/lib/twitter/bearer-token';

/**
 * POST: Refresh the bearer token for a Twitter App
 * This endpoint will:
 * 1. Verify the current bearer token
 * 2. If invalid, generate a new one
 * 3. Update the database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: twitterAppId } = await params;

    // Get TwitterApp from database
    const twitterApp = await prisma.twitterApp.findUnique({
      where: { id: twitterAppId }
    });

    if (!twitterApp) {
      return NextResponse.json({ error: 'TwitterApp not found' }, { status: 404 });
    }

    console.log('🔄 Refreshing bearer token for TwitterApp:', twitterApp.name);

    // First, check if current token is valid
    if (twitterApp.bearerToken) {
      console.log('   Verifying current token...');
      const isValid = await verifyBearerToken(twitterApp.bearerToken);

      if (isValid) {
        console.log('   ✅ Current token is still valid');
        return NextResponse.json({
          success: true,
          message: 'Current bearer token is still valid',
          tokenValid: true
        });
      }

      console.log('   ❌ Current token is invalid or expired');
    }

    // Generate new bearer token
    console.log('   🔑 Generating new bearer token...');
    try {
      const newBearerToken = await createBearerToken(
        twitterApp.consumerKey,
        twitterApp.consumerSecret
      );

      // Update database
      await prisma.twitterApp.update({
        where: { id: twitterAppId },
        data: { bearerToken: newBearerToken }
      });

      console.log('   ✅ Bearer token refreshed successfully');

      return NextResponse.json({
        success: true,
        message: 'Bearer token refreshed successfully',
        tokenValid: true
      });

    } catch (tokenError: any) {
      console.error('   ❌ Failed to create bearer token:', tokenError);

      // Check if it's a credentials issue
      if (tokenError.message.includes('401') || tokenError.message.includes('403')) {
        return NextResponse.json({
          error: 'Invalid Twitter API credentials. Please check Consumer Key and Consumer Secret.',
          details: tokenError.message
        }, { status: 400 });
      }

      throw tokenError;
    }

  } catch (error: any) {
    console.error('Error refreshing bearer token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh bearer token', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET: Check if the bearer token is valid
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: twitterAppId } = await params;

    // Get TwitterApp from database
    const twitterApp = await prisma.twitterApp.findUnique({
      where: { id: twitterAppId }
    });

    if (!twitterApp) {
      return NextResponse.json({ error: 'TwitterApp not found' }, { status: 404 });
    }

    if (!twitterApp.bearerToken) {
      return NextResponse.json({
        success: true,
        tokenValid: false,
        message: 'No bearer token configured'
      });
    }

    // Verify token
    const isValid = await verifyBearerToken(twitterApp.bearerToken);

    return NextResponse.json({
      success: true,
      tokenValid: isValid,
      message: isValid ? 'Bearer token is valid' : 'Bearer token is invalid or expired'
    });

  } catch (error: any) {
    console.error('Error checking bearer token:', error);
    return NextResponse.json(
      { error: 'Failed to check bearer token', details: error.message },
      { status: 500 }
    );
  }
}