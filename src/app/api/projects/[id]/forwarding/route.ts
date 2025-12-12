import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import {
  getForwardingConfig,
  saveForwardingConfig as saveForwardingConfigDb,
  deleteForwardingConfig as deleteForwardingConfigDb
} from '@/lib/db/forwarding';

/**
 * GET: Get webhook forwarding configuration for a specific project
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

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const config = await getForwardingConfig(projectId);

    return NextResponse.json({
      configured: !!config,
      config: config || null,
    });
  } catch (error: any) {
    console.error('Error getting forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to get forwarding configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST: Save webhook forwarding configuration for a specific project
 * This will register the webhook with Twitter when saving the endpoint
 */
export async function POST(
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

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { endpoint, enabled } = body;

    // Validate endpoint URL
    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Save forwarding configuration
    console.log('');
    console.log('=== SAVING FORWARDING CONFIG ===');
    console.log('   Endpoint:', endpoint);
    console.log('   Enabled:', enabled !== false);
    await saveForwardingConfigDb(projectId, {
      endpoint,
      enabled: enabled !== false, // Default to true
    });

    console.log('✅ Forwarding configuration saved');
    console.log('=== FORWARDING CONFIG SAVE COMPLETE ===');
    console.log('');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to save forwarding configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete webhook forwarding configuration for a specific project
 * This will also delete the webhook from Twitter
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

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log('');
    console.log('=== DELETING FORWARDING CONFIG ===');
    console.log('   Project:', project.name, `(${project.id})`);

    // Delete forwarding configuration
    await deleteForwardingConfigDb(projectId);

    console.log('✅ Forwarding configuration deleted');
    console.log('=== FORWARDING CONFIG DELETION COMPLETE ===');
    console.log('');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting forwarding config:', error);
    return NextResponse.json(
      { error: 'Failed to delete forwarding configuration' },
      { status: 500 }
    );
  }
}
