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
    // Access session first, before using params
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Now that we've awaited something, we can access params
    const threadId = params.id;
    
    console.log(`[API] Sending message to thread ${threadId} from user ${userId}`);

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      console.log(`[API] User ${userId} does not have access to thread ${threadId}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);
    console.log(`[API] Message content (first 50 chars): ${validatedData.content.substring(0, 50)}...`);

    console.log(`[API] Calling ChatService.sendMessage for thread ${threadId}`);
    const result = await ChatService.sendMessage(
      threadId,
      userId,
      validatedData.content
    );
    console.log(`[API] Message sent successfully, runId: ${result.run?.id}, status: ${result.run?.status}`);

    return NextResponse.json(result);
  } catch (error) {
    const errorInfo = {
      action: 'send_message',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    logger.error(error, errorInfo);
    console.error(`[API] Error sending message:`, error);

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