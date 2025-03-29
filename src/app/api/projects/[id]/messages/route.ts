import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const projectId = id;
    const userId = session.user.id;
    
    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get search parameters for role filtering
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    // Get the project to verify it exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        threads: { select: { id: true } },
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get thread IDs associated with the project
    const threadIds = project.threads.map(thread => thread.id);
    
    // Count messages from all project threads, optionally filtering by role
    const whereClause = {
      threadId: { in: threadIds },
      ...(role ? { role } : {})
    };
    
    const total = await prisma.message.count({
      where: whereClause
    });

    return NextResponse.json({
      total,
      role: role || 'all',
      threadCount: threadIds.length
    });
  } catch (error) {
    console.error('Error fetching project messages count:', error);
    logger.error(error, {
      action: 'get_project_messages_count',
      projectId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to fetch project messages count' },
      { status: 500 }
    );
  }
} 