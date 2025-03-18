import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess, isProjectManagerOrAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

/**
 * GET /api/projects/[id]/files
 * Get all files for a project (simplified version for debugging)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('Files API - Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = id;
    const userId = session.user.id;
    
    console.log(`Files API - Fetching files for project ${projectId}, user: ${userId}`);

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      console.log(`Files API - User ${userId} does not have access to project ${projectId}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the project to find the assistant ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        assistantId: true
      }
    });

    console.log(`Files API - Project details:`, project);

    if (!project) {
      console.log(`Files API - Project ${projectId} not found`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Prepare the OR conditions for file associations
    const associationConditions: Prisma.FileAssociationWhereInput[] = [
      { associableType: 'Project', associableId: projectId }
    ];
    
    // Add assistant condition if it exists
    if (project.assistantId) {
      associationConditions.push({ 
        associableType: 'Assistant', 
        associableId: project.assistantId 
      });
    }

    // Find files associated with this project or its assistant
    const files = await prisma.file.findMany({
      where: {
        associations: {
          some: {
            OR: associationConditions
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true }
        },
        associations: true
      }
    });
    
    console.log(`Files API - Found ${files.length} files in database for project ${projectId}`);
    
    // Debug information
    if (files.length > 0) {
      console.log(`Files API - First 3 files:`, files.slice(0, 3).map(f => ({
        id: f.id,
        name: f.name,
        openaiFileId: f.openaiFileId,
        associations: f.associations.map(a => `${a.associableType}:${a.associableId}`)
      })));
    } else {
      console.log(`Files API - No files found, getting recent files as backup...`);
      
      // As a backup for debugging, get any files recently uploaded by the user
      const recentFiles = await prisma.file.findMany({
        where: {
          uploadedById: userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          associations: true,
          uploadedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
      
      console.log(`Files API - Found ${recentFiles.length} recent files uploaded by user`);
      if (recentFiles.length > 0) {
        console.log(`Files API - Recent files:`, recentFiles.map(f => ({
          id: f.id,
          name: f.name,
          openaiFileId: f.openaiFileId,
          associations: f.associations.map(a => `${a.associableType}:${a.associableId}`)
        })));
        
        // Return these files for testing
        files.push(...recentFiles);
      }
    }
    
    // Transform to expected format that matches what the frontend expects
    const formattedFiles = files.map(file => ({
      id: file.id,
      openaiFileId: file.openaiFileId,
      name: file.name,
      filename: file.name, // For compatibility with OpenAI API response format
      bytes: file.size,
      size: file.size, // For compatibility with our frontend
      purpose: file.mimeType,
      type: file.mimeType, // For compatibility with our frontend
      created_at: Math.floor(file.createdAt.getTime() / 1000),
      createdAt: file.createdAt.toISOString(), // For compatibility with our frontend
      uploadedBy: file.uploadedBy ? {
        id: file.uploadedBy.id,
        name: file.uploadedBy.name,
        email: file.uploadedBy.email
      } : null
    }));
    
    return NextResponse.json(formattedFiles);
  } catch (error) {
    console.error('Files API Error:', error);
    logger.error(error, {
      action: 'get_project_files',
      projectId: params.id
    });

    return NextResponse.json(
      { 
        error: 'Failed to fetch project files',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: []  // Return empty array to prevent frontend crash
      },
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

    // Get parameters
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

    // Get the file from our database with all associations
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        associations: true
      }
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found in database' },
        { status: 404 }
      );
    }

    // Get the project to find the vector store ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        vectorStoreId: true,
        assistantId: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if file is associated with this project
    const isAssociatedWithProject = file.associations.some(
      a => (a.associableType === 'Project' && a.associableId === projectId) ||
           (project.assistantId && a.associableType === 'Assistant' && a.associableId === project.assistantId)
    );

    if (!isAssociatedWithProject) {
      console.log(`File ${fileId} is not associated with project ${projectId} or its assistant`);
      console.log('File associations:', file.associations.map(a => `${a.associableType}:${a.associableId}`));
      
      try {
        // Add a Project association (not an Assistant association which causes the foreign key error)
        console.log(`Creating project association for file ${fileId} with project ${projectId}`);
        await prisma.fileAssociation.create({
          data: {
            fileId: fileId,
            associableType: 'Project',
            associableId: projectId
            // Don't explicitly set assistantId to avoid type errors
          }
        });
        
        console.log(`Added project association to file ${fileId}`);
      } catch (assocError) {
        // Log but continue - we'll still try to delete the file
        console.error(`Error creating association:`, assocError);
        logger.error(assocError, {
          action: 'create_file_association',
          projectId,
          fileId
        });
        
        // We won't block deletion if association fails
        console.log("Continuing with file deletion despite association error");
      }
    }

    // Import AIService for file and vector store operations
    const { AIService } = await import('@/lib/services/ai-service');

    // If the file has an OpenAI ID, handle OpenAI-related cleanup
    if (file.openaiFileId) {
      // 1. If the file is in a vector store, remove it from there first
      if (project.vectorStoreId) {
        const vectorStore = await prisma.vectorStore.findUnique({
          where: { id: project.vectorStoreId }
        });

        if (vectorStore?.openaiVectorStoreId) {
          try {
            await AIService.removeFileFromVectorStore(file.openaiFileId, vectorStore.openaiVectorStoreId);
            console.log(`Successfully deleted file ${file.openaiFileId} from vector store ${vectorStore.openaiVectorStoreId}`);
          } catch (vectorError) {
            logger.error(vectorError, {
              action: 'delete_vectorstore_file',
              projectId,
              fileId,
              openaiFileId: file.openaiFileId,
              vectorStoreId: vectorStore.openaiVectorStoreId
            });
            // Continue with database cleanup even if vector store deletion fails
          }
        } else {
          console.warn(`Vector store ID ${project.vectorStoreId} does not have a valid OpenAI ID`);
        }
      }

      // 2. Delete the file from OpenAI's files API (regardless of vector store)
      try {
        await AIService.deleteFileFromOpenAI(file.openaiFileId);
        console.log(`Successfully deleted file ${file.openaiFileId} from OpenAI files API`);
      } catch (fileError) {
        logger.error(fileError, {
          action: 'delete_openai_file',
          projectId,
          fileId,
          openaiFileId: file.openaiFileId
        });
        // Continue with database cleanup even if OpenAI file deletion fails
      }
    } else {
      console.warn(`File ${fileId} does not have an OpenAI file ID`);
    }

    // Delete file associations - do this first to avoid foreign key issues
    try {
      await prisma.fileAssociation.deleteMany({
        where: {
          fileId: fileId
        }
      });
      console.log(`Deleted all associations for file ${fileId}`);
    } catch (deleteAssocError) {
      // Log but continue - we'll still try to delete the file
      console.error(`Error deleting file associations:`, deleteAssocError);
      logger.error(deleteAssocError, {
        action: 'delete_file_associations',
        projectId,
        fileId
      });
    }

    // Delete the file from our database 
    try {
      await prisma.file.delete({
        where: {
          id: fileId
        }
      });
      console.log(`Deleted file ${fileId} from database`);
    } catch (deleteFileError) {
      console.error(`Error deleting file from database:`, deleteFileError);
      logger.error(deleteFileError, {
        action: 'delete_file_from_db',
        projectId,
        fileId
      });
      throw deleteFileError; // Rethrow to handle in outer catch
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
    console.error('Error deleting file:', error);
    logger.error(error, {
      action: 'delete_project_file',
      projectId: await params.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
} 