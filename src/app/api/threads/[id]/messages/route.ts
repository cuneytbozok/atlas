import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ChatService } from '@/lib/services/chat-service';
import { hasThreadAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { ZodError, z } from 'zod';

// Schema for sending a message
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000)
});

/**
 * POST /api/threads/[id]/messages
 * Send a message to a thread
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

    const threadId = params.id;
    const userId = session.user.id;

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    const result = await ChatService.sendMessage(
      threadId,
      userId,
      validatedData.content
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error(error, {
      action: 'send_message',
      threadId: params.id
    });

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
} 