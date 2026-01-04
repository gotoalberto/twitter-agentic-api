import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: List all forwarding endpoints for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    const endpoints = await prisma.forwardingEndpoint.findMany({
      where: { projectId },
      orderBy: { priority: 'asc' },
      include: {
        _count: {
          select: {
            deliveries: {
              where: { status: 'delivered' }
            }
          }
        }
      }
    });

    return NextResponse.json({ endpoints });
  } catch (error: any) {
    console.error('Error getting endpoints:', error);
    return NextResponse.json(
      { error: 'Failed to get endpoints' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new forwarding endpoint
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

    const { id: projectId } = await params;
    const body = await request.json();
    const { name, url, enabled, priority } = body;

    // Validations
    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Create endpoint
    const endpoint = await prisma.forwardingEndpoint.create({
      data: {
        projectId,
        name,
        url,
        enabled: enabled !== false, // Default to true
        priority: priority ?? 0,
      }
    });

    console.log('✅ Endpoint created');
    console.log('   Name:', endpoint.name);
    console.log('   URL:', endpoint.url);
    console.log('   Enabled:', endpoint.enabled);

    return NextResponse.json({ endpoint });
  } catch (error: any) {
    console.error('Error creating endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to create endpoint' },
      { status: 500 }
    );
  }
}
