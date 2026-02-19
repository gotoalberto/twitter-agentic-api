import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';

/**
 * PUT: Assign or unassign a TwitterApp to a Project
 * Body: { twitterAppId: string | null }
 */
export async function PUT(
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
    const { twitterAppId } = body;

    // Validate project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate app exists if assigning
    if (twitterAppId) {
      const app = await prisma.twitterApp.findUnique({ where: { id: twitterAppId } });
      if (!app) {
        return NextResponse.json({ error: 'Twitter App not found' }, { status: 404 });
      }
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { twitterAppId: twitterAppId || null },
      include: { twitterApp: true },
    });

    return NextResponse.json({
      project: {
        id: updated.id,
        name: updated.name,
        twitterAppId: updated.twitterAppId,
        twitterApp: updated.twitterApp
          ? { id: updated.twitterApp.id, name: updated.twitterApp.name }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error assigning Twitter App to project:', error);
    return NextResponse.json({ error: 'Failed to update project app' }, { status: 500 });
  }
}
