import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ChatService } from '@/lib/services/chat-service';
import { hasProjectAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { ZodError, z } from 'zod';
import { prisma } from '@/lib/prisma';

// Schema for creating a thread
const createThreadSchema = z.object({
  title: z.string().optional()
});

/**
 * GET /api/projects/[id]/threads
 * Get threads for a project
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

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threads = await ChatService.getThreads(projectId, userId);
    return NextResponse.json(threads);
  } catch (error) {
    logger.error(error, {
      action: 'get_project_threads',
      projectId: params.id
    });
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/threads
 * Create a new thread for a project
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

    // Check if project is archived or completed
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'archived' || project.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot create new threads for archived or completed projects' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createThreadSchema.parse(body);

    const thread = await ChatService.createThread(
      projectId, 
      userId, 
      validatedData.title
    );

    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    logger.error(error, {
      action: 'create_project_thread',
      projectId: params.id
    });

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
} 