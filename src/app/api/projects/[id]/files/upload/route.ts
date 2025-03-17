import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AIService } from '@/lib/services/ai-service';

/**
 * POST /api/projects/[id]/files/upload
 * Upload a file to a project and associate it with the project
 */
export async function POST(
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

    // Get the file data from the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    // Get file meta data
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    const fileName = file.name;
    const mimeType = file.type;
    const fileSize = file.size;

    // Get project details to check for vector store
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { vectorStore: true }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create the file in OpenAI and our database
    try {
      // Upload to OpenAI - this depends on your AI service implementation
      const openaiFileId = await AIService.uploadFileToOpenAI(fileBytes, fileName, mimeType);

      // Create the file in our database
      const dbFile = await prisma.file.create({
        data: {
          name: fileName,
          mimeType: mimeType,
          size: fileSize,
          openaiFileId: openaiFileId,
          uploadedById: userId,
          associations: {
            create: {
              associableType: 'Project',
              associableId: projectId
            }
          }
        }
      });

      // If the project has a vector store, create a file association with it
      if (project.vectorStoreId && project.vectorStore?.openaiVectorStoreId) {
        await AIService.addFileToVectorStore(
          openaiFileId, 
          project.vectorStore.openaiVectorStoreId
        );
      }

      // Log the activity
      await prisma.activityLog.create({
        data: {
          userId: userId,
          action: 'UPLOAD_FILE',
          entityType: 'FILE',
          entityId: dbFile.id,
          timestamp: new Date()
        }
      });

      return NextResponse.json(dbFile, { status: 201 });

    } catch (aiError) {
      logger.error(aiError, {
        action: 'upload_file_to_openai',
        projectId,
        fileName
      });

      return NextResponse.json(
        { error: 'Failed to upload file to AI provider' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error(error, {
      action: 'upload_project_file',
      projectId: params.id
    });

    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 