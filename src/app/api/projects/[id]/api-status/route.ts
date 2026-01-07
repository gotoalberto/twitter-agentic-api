import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

/**
 * PATCH: Toggle API enabled status for a project
 */
export async function PATCH(
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
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        apiEnabled: enabled,
      },
    });

    console.log('✅ API status updated');
    console.log('   Project:', project.name);
    console.log('   API Enabled:', project.apiEnabled);

    return NextResponse.json({
      success: true,
      apiEnabled: project.apiEnabled
    });
  } catch (error: any) {
    console.error('Error updating API status:', error);
    return NextResponse.json(
      { error: 'Failed to update API status' },
      { status: 500 }
    );
  }
}
