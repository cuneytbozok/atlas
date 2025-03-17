import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ChatService } from '@/lib/services/chat-service';
import { hasThreadAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { ZodError, z } from 'zod';

// Schema for updating a thread
const updateThreadSchema = z.object({
  title: z.string().min(1).max(100)
});

/**
 * GET /api/threads/[id]
 * Get a specific thread with its messages
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

    const threadId = params.id;
    const userId = session.user.id;

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const thread = await ChatService.getThread(threadId, userId);
    return NextResponse.json(thread);
  } catch (error) {
    logger.error(error, {
      action: 'get_thread',
      threadId: params.id
    });
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/threads/[id]
 * Update a thread (currently just allows renaming)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = params.id;
    const userId = session.user.id;

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateThreadSchema.parse(body);

    const thread = await ChatService.renameThread(
      threadId, 
      userId, 
      validatedData.title
    );

    return NextResponse.json(thread);
  } catch (error) {
    logger.error(error, {
      action: 'update_thread',
      threadId: params.id
    });

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/threads/[id]
 * Delete a thread
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = params.id;
    const userId = session.user.id;

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ChatService.deleteThread(threadId, userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error, {
      action: 'delete_thread',
      threadId: params.id
    });
    
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    );
  }
} 