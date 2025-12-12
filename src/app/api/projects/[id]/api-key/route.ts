/**
 * API Key Management Endpoint
 *
 * GET: Get current API key configuration
 * POST: Generate or update API key
 * DELETE: Remove API key (make endpoint public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/prisma';
import { randomBytes } from 'crypto';

/**
 * GET: Get API key configuration status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      configured: !!project.apiKey,
      apiKey: project.apiKey, // Return the actual key (only visible to admin)
    });
  } catch (error: any) {
    console.error('Error getting API key:', error);
    return NextResponse.json(
      { error: 'Failed to get API key configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST: Generate or update API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate new API key (32 bytes = 64 hex characters)
    const apiKey = `bta_${randomBytes(32).toString('hex')}`;

    // Update project with new API key
    await prisma.project.update({
      where: { id: projectId },
      data: { apiKey },
    });

    console.log('✅ API key generated for project:', project.name);

    return NextResponse.json({
      success: true,
      apiKey,
      message: 'API key generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove API key (make endpoint public again)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Remove API key
    await prisma.project.update({
      where: { id: projectId },
      data: { apiKey: null },
    });

    console.log('✅ API key removed for project:', project.name);

    return NextResponse.json({
      success: true,
      message: 'API key removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing API key:', error);
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    );
  }
}
