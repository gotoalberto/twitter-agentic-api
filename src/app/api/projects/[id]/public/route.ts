import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db/projects';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Get project info (public endpoint - no auth required)
    const project = await getProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Return limited public information
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        bot: project.bot ? {
          id: project.bot.id,
          username: project.bot.username,
          userId: project.bot.userId
        } : null,
        twitterApp: project.twitterApp ? {
          id: project.twitterApp.id,
          name: project.twitterApp.name
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching public project info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}