import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { hasProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AIService } from '@/lib/services/ai-service';

/**
 * POST /api/projects/[id]/files/upload
 * Upload one or more files to a project and associate them with the project
 * Supports both single file upload and multiple file uploads
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

    // Await params to access its properties
    const { id } = await params;
    const projectId = id;
    const userId = session.user.id;

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the file(s) data from the form data
    const formData = await request.formData();
    const files = formData.getAll('file');

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Check if files are valid File objects
    const validFiles = files.filter(file => file instanceof File) as File[];
    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files provided' },
        { status: 400 }
      );
    }

    // Check file sizes (20MB limit per file)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    const oversizedFiles = validFiles.filter(file => file.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        { 
          error: 'File size exceeds the limit',
          details: `Files exceeding the 20MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`
        },
        { status: 400 }
      );
    }

    // Get project details to check for vector store
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { 
        vectorStore: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.vectorStoreId || !project.vectorStore?.openaiVectorStoreId) {
      return NextResponse.json(
        { error: 'Vector store not configured for this project' },
        { status: 400 }
      );
    }
    
    // Fetch the project's assistant if one exists
    let assistant = null;
    if (project.assistantId) {
      assistant = await prisma.assistant.findUnique({
        where: { id: project.assistantId }
      });
    }

    // Process all files
    const uploadedFiles = [];
    const openaiFileIds = [];
    const failedFiles = [];

    for (const file of validFiles) {
      try {
        // Get file metadata
        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        const fileName = file.name;
        const mimeType = file.type;
        const fileSize = file.size;

        console.log('Uploading file to OpenAI:', {
          action: 'uploading_file',
          projectId,
          fileName,
          fileSize,
          mimeType
        });

        // Upload to OpenAI
        const openaiFileId = await AIService.uploadFileToOpenAI(fileBytes, fileName, mimeType);
        if (!openaiFileId) {
          throw new Error('OpenAI returned an empty file ID');
        }
        
        openaiFileIds.push(openaiFileId);
        console.log('File uploaded to OpenAI successfully:', {
          action: 'file_uploaded_to_openai',
          projectId,
          fileName,
          openaiFileId
        });

        // Create the file in our database without associations
        const dbFile = await prisma.file.create({
          data: {
            name: fileName,
            mimeType: mimeType,
            size: fileSize,
            openaiFileId: openaiFileId,
            uploadedById: userId,
          }
        });

        // If project has an assistant, create file association with the assistant instead
        if (project.assistantId && assistant) {
          try {
            await prisma.fileAssociation.create({
              data: {
                fileId: dbFile.id,
                associableType: 'Assistant',
                associableId: assistant.id
              }
            });
            
            console.log('File associated with project assistant:', {
              fileId: dbFile.id,
              assistantId: assistant.id,
              projectId
            });
          } catch (associationError) {
            console.error('Error creating assistant file association:', associationError);
            logger.error(associationError, {
              action: 'create_assistant_file_association_failed',
              fileId: dbFile.id,
              assistantId: assistant.id,
              projectId
            });
            // Continue even if association creation fails
          }
        } else {
          console.log('No assistant available for file association', {
            fileId: dbFile.id,
            projectId
          });
        }

        uploadedFiles.push(dbFile);
        console.log('File record created in database:', {
          action: 'file_record_created',
          projectId,
          fileName,
          fileId: dbFile.id,
          openaiFileId
        });

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
      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
        logger.error(fileError, {
          action: 'upload_file_to_openai_failed',
          projectId,
          fileName: file.name,
          error: errorMessage
        });
        
        failedFiles.push({
          name: file.name,
          error: errorMessage
        });
        // Continue with other files even if one fails
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to upload any files',
          failedFiles: failedFiles
        },
        { status: 500 }
      );
    }

    // Add files to vector store - use batch API if multiple files
    try {
      if (openaiFileIds.length === 1) {
        // Single file - use single file API
        await AIService.addFileToVectorStore(
          openaiFileIds[0], 
          project.vectorStore.openaiVectorStoreId
        );
        
        console.log(`Successfully added file to vector store: ${openaiFileIds[0]}`);
      } else if (openaiFileIds.length > 1) {
        // Multiple files - use batch API
        const batchResult = await AIService.addFileBatchToVectorStore(
          openaiFileIds, 
          project.vectorStore.openaiVectorStoreId
        );
        
        console.log(`Successfully added ${openaiFileIds.length} files to vector store in batch: ${JSON.stringify(batchResult)}`);
      }
    } catch (vectorStoreError) {
      console.error('Vector store error details:', vectorStoreError);
      
      // Log the error but continue - we'll return the files even if vector store association fails
      logger.error(vectorStoreError, {
        action: 'add_files_to_vector_store',
        projectId,
        fileCount: openaiFileIds.length,
        error: vectorStoreError instanceof Error ? vectorStoreError.message : 'Unknown error',
        vectorStoreId: project.vectorStore.openaiVectorStoreId
      });
      
      // Add a warning to the response
      const warningMessage = 'Files were uploaded but may not be immediately available in the vector store.';
      
      // Continue even if vector store addition fails, as files are already uploaded to OpenAI
      // Return the files with a warning
      if (uploadedFiles.length === 1) {
        return NextResponse.json({ 
          ...uploadedFiles[0], 
          warning: warningMessage
        }, { status: 201 });
      } else {
        return NextResponse.json({ 
          files: uploadedFiles, 
          warning: warningMessage
        }, { status: 201 });
      }
    }
    
    // If we get here, everything succeeded
    // Return the first file for backward compatibility with single file upload
    // or all files if multiple were uploaded
    if (uploadedFiles.length === 1) {
      return NextResponse.json(uploadedFiles[0], { status: 201 });
    } else {
      return NextResponse.json(uploadedFiles, { status: 201 });
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