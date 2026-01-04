import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

/**
 * GET: Get specific endpoint details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, endpointId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpointId } = await params;

    const endpoint = await prisma.forwardingEndpoint.findUnique({
      where: { id: endpointId },
      include: {
        _count: {
          select: {
            deliveries: true
          }
        }
      }
    });

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    return NextResponse.json({ endpoint });
  } catch (error: any) {
    console.error('Error getting endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to get endpoint' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update endpoint
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, endpointId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpointId } = await params;
    const body = await request.json();
    const { name, url, enabled, priority } = body;

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    const endpoint = await prisma.forwardingEndpoint.update({
      where: { id: endpointId },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(enabled !== undefined && { enabled }),
        ...(priority !== undefined && { priority }),
      }
    });

    console.log('✅ Endpoint updated');
    console.log('   Name:', endpoint.name);
    console.log('   Enabled:', endpoint.enabled);

    return NextResponse.json({ endpoint });
  } catch (error: any) {
    console.error('Error updating endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to update endpoint' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete endpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, endpointId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpointId } = await params;

    await prisma.forwardingEndpoint.delete({
      where: { id: endpointId }
    });

    console.log('✅ Endpoint deleted');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to delete endpoint' },
      { status: 500 }
    );
  }
}
