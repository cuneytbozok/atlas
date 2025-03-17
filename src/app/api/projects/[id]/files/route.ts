import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[id]/files
 * Get all files for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get files associated with the project
    const files = await prisma.file.findMany({
      where: {
        associations: {
          some: {
            associableType: 'Project',
            associableId: projectId
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(files);
  } catch (error) {
    logger.error(error, {
      action: 'get_project_files',
      projectId: params.id
    });

    return NextResponse.json(
      { error: 'Failed to fetch project files' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/files/[fileId]
 * Delete a file from a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fileId?: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if file exists and is associated with the project
    const fileAssociation = await prisma.fileAssociation.findFirst({
      where: {
        fileId: fileId,
        associableType: 'Project',
        associableId: projectId
      }
    });

    if (!fileAssociation) {
      return NextResponse.json(
        { error: 'File not found or not associated with this project' },
        { status: 404 }
      );
    }

    // Remove file association
    await prisma.fileAssociation.delete({
      where: {
        id: fileAssociation.id
      }
    });

    // Check if file has other associations - if not, delete the file
    const otherAssociations = await prisma.fileAssociation.count({
      where: {
        fileId: fileId
      }
    });

    if (otherAssociations === 0) {
      // No other associations, delete the file
      await prisma.file.delete({
        where: {
          id: fileId
        }
      });
    }

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: userId,
        action: 'DELETE_FILE',
        entityType: 'FILE',
        entityId: fileId,
        timestamp: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error, {
      action: 'delete_project_file',
      projectId: params.id
    });

    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
} 