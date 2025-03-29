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

    // Get search parameters for pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get project-related activity logs
    // This includes:
    // 1. Files uploaded/deleted related to this project
    // 2. Threads created within this project
    // 3. Project member additions/removals
    // 4. Project updates

    // First, get project entity IDs
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { select: { id: true } },
        threads: { select: { id: true } },
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get file IDs associated with the project
    const fileAssociations = await prisma.fileAssociation.findMany({
      where: {
        OR: [
          { associableType: 'Project', associableId: projectId },
          ...(project.assistantId 
            ? [{ associableType: 'Assistant', associableId: project.assistantId }]
            : [])
        ],
      },
      select: { fileId: true },
    });
    
    const fileIds = fileAssociations.map(fa => fa.fileId);
    const threadIds = project.threads.map(thread => thread.id);
    const memberIds = project.members.map(member => member.id);

    // Now get activity logs related to this project
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          // Project-specific activities
          { entityType: 'PROJECT', entityId: projectId },
          
          // File activities for associated files
          { entityType: 'FILE', entityId: { in: fileIds } },
          
          // Thread activities for project threads
          { entityType: 'THREAD', entityId: { in: threadIds } },
          
          // Member activities
          { entityType: 'PROJECT_MEMBER', entityId: { in: memberIds } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Get additional context information for the activities
    const enrichedLogs = await Promise.all(
      activityLogs.map(async (log) => {
        let context = {};

        // Get related entity details based on entityType
        if (log.entityType === 'FILE') {
          const file = await prisma.file.findUnique({
            where: { id: log.entityId },
            select: { name: true, size: true, mimeType: true },
          });
          if (file) context = { file };
        } 
        else if (log.entityType === 'PROJECT_MEMBER') {
          const member = await prisma.projectMember.findUnique({
            where: { id: log.entityId },
            select: {
              user: { select: { name: true, email: true } },
              role: { select: { name: true } },
            },
          });
          if (member) context = { member };
        }
        else if (log.entityType === 'THREAD') {
          const thread = await prisma.thread.findUnique({
            where: { id: log.entityId },
            select: { title: true },
          });
          if (thread) context = { thread };
        }

        return {
          ...log,
          context,
        };
      })
    );

    // Count total activities for pagination
    const totalCount = await prisma.activityLog.count({
      where: {
        OR: [
          { entityType: 'PROJECT', entityId: projectId },
          { entityType: 'FILE', entityId: { in: fileIds } },
          { entityType: 'THREAD', entityId: { in: threadIds } },
          { entityType: 'PROJECT_MEMBER', entityId: { in: memberIds } },
        ],
      },
    });

    return NextResponse.json({
      activities: enrichedLogs,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching project activity:', error);
    logger.error(error, {
      action: 'get_project_activity',
      projectId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to fetch project activity' },
      { status: 500 }
    );
  }
} 