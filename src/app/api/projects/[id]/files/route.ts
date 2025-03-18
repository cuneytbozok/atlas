import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess, isProjectManagerOrAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[id]/files
 * Get all files for a project from the OpenAI Vector Store
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

    // Await params to access its properties
    const { id } = await params;
    const projectId = id;
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the project to find the vector store ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { vectorStoreId: true }
    });

    if (!project?.vectorStoreId) {
      return NextResponse.json({ error: 'Vector store not found for this project' }, { status: 404 });
    }

    // Use Vector Store API to get files
    if (source === 'vectorstore') {
      // Import AIService to fetch files from the Vector Store API
      const { AIService } = await import('@/lib/services/ai-service');
      try {
        console.log(`Getting files for project ${projectId} from vector store ID ${project.vectorStoreId}`);
        
        // Check if we have a valid vector store in our database
        const vectorStore = await prisma.vectorStore.findUnique({
          where: { id: project.vectorStoreId }
        });
        
        if (!vectorStore?.openaiVectorStoreId) {
          return NextResponse.json(
            { error: 'Vector store record exists but has no OpenAI ID' },
            { status: 500 }
          );
        }
        
        console.log(`Using OpenAI vector store ID: ${vectorStore.openaiVectorStoreId}`);
        
        try {
          // Get files directly from OpenAI API
          const vectorStoreFiles = await AIService.getVectorStoreFiles(vectorStore.openaiVectorStoreId);
          console.log(`Retrieved ${vectorStoreFiles.length} files from vector store`);
          
          return NextResponse.json(vectorStoreFiles);
        } catch (openaiError) {
          console.error("OpenAI vector store API error:", openaiError);
          
          // Fallback: Try to get files from our database that are associated with this project's assistant
          console.log("Falling back to database files");
          
          // Check if the project has an assistant
          const projectWithAssistant = await prisma.project.findUnique({
            where: { id: projectId },
            select: { assistantId: true }
          });
          
          if (!projectWithAssistant?.assistantId) {
            throw new Error("Project has no assistant");
          }
          
          // Get files associated with the project's assistant
          const assistantFiles = await prisma.file.findMany({
            where: {
              associations: {
                some: {
                  associableType: 'Assistant',
                  associableId: projectWithAssistant.assistantId
                }
              }
            }
          });
          
          console.log(`Retrieved ${assistantFiles.length} files from database`);
          
          // Transform to match expected format
          const formattedFiles = assistantFiles.map(file => ({
            id: file.openaiFileId || file.id,
            filename: file.name,
            bytes: file.size,
            purpose: file.mimeType,
            created_at: Math.floor(file.createdAt.getTime() / 1000)
          }));
          
          return NextResponse.json(formattedFiles);
        }
      } catch (vectorError) {
        const errorMessage = vectorError instanceof Error ? vectorError.message : 'Unknown error';
        console.error(`Error fetching vector store files:`, errorMessage);
        
        logger.error(vectorError, {
          action: 'get_vectorstore_files',
          projectId,
          vectorStoreId: project.vectorStoreId,
          error: errorMessage
        });
        
        // Return an empty array with a warning instead of an error
        // This allows the UI to show a message but not crash
        return NextResponse.json(
          {
            data: [], // Empty array to ensure client code doesn't crash
            warning: 'Unable to fetch files from vector store or database',
            details: errorMessage
          }
        );
      }
    }

    // Fallback: Get files associated with the project from database
    // This should only be used internally, normal file listing should use vectorstore
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
 * DELETE /api/projects/[id]/files?fileId=[fileId]
 * Delete a file from a project and optionally from the Vector Store
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

    // Await params to access its properties
    const { id } = await params;
    const projectId = id;
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

    // Check if user is a project manager or admin
    const canDelete = await isProjectManagerOrAdmin(projectId, userId);
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only project managers and administrators can delete files' },
        { status: 403 }
      );
    }

    // Get the project to find the vector store ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { vectorStoreId: true }
    });

    if (!project?.vectorStoreId) {
      return NextResponse.json({ error: 'Vector store not found for this project' }, { status: 404 });
    }

    // Try to delete the file from the vector store first
    const { AIService } = await import('@/lib/services/ai-service');
    try {
      // Delete the file from the Vector Store
      await AIService.removeFileFromVectorStore(fileId, project.vectorStoreId);
      console.log(`Successfully deleted file ${fileId} from vector store ${project.vectorStoreId}`);
    } catch (vectorError) {
      logger.error(vectorError, {
        action: 'delete_vectorstore_file',
        projectId,
        fileId,
        vectorStoreId: project.vectorStoreId
      });
      // Continue with database cleanup even if vector store deletion fails
    }

    // Also clean up database records if they exist
    try {
      // Check if file exists and is associated with the project
      const fileAssociation = await prisma.fileAssociation.findFirst({
        where: {
          fileId: fileId,
          associableType: 'Project',
          associableId: projectId
        }
      });

      if (fileAssociation) {
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
      }
    } catch (dbError) {
      logger.error(dbError, {
        action: 'delete_file_db_records',
        projectId,
        fileId
      });
      // Continue even if database cleanup fails
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