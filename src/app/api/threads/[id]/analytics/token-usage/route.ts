import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { hasThreadAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';

interface MessageWithTokens {
  id: string;
  content: string;
  role: string;
  runId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  createdAt: Date;
}

/**
 * GET /api/threads/[id]/analytics/token-usage
 * 
 * Returns token usage statistics for a specific thread.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user session and check thread access permissions
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = params.id;
    const userId = session.user.id;

    // Check if user has access to the thread
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get thread with token usage info
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        title: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      }
    }) as any;

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // Get message-level token usage statistics
    const messages = await prisma.message.findMany({
      where: { threadId },
      select: {
        id: true,
        content: true,
        role: true,
        createdAt: true,
        // runId and token fields will be returned from the database
        // even though they're not in the TypeScript types yet
      },
      orderBy: { createdAt: 'asc' }
    }) as unknown as MessageWithTokens[];

    // Calculate totals from messages
    const totalFromMessages = {
      promptTokens: messages.reduce((sum, message) => sum + (message.promptTokens || 0), 0),
      completionTokens: messages.reduce((sum, message) => sum + (message.completionTokens || 0), 0),
      totalTokens: messages.reduce((sum, message) => sum + (message.totalTokens || 0), 0)
    };

    // Return the thread token usage and message breakdowns
    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        projectId: thread.projectId,
        promptTokens: thread.promptTokens || 0,
        completionTokens: thread.completionTokens || 0,
        totalTokens: thread.totalTokens || 0,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt
      },
      messages: messages.map(message => ({
        id: message.id,
        content: message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content,
        role: message.role,
        runId: message.runId,
        promptTokens: message.promptTokens || 0,
        completionTokens: message.completionTokens || 0,
        totalTokens: message.totalTokens || 0,
        createdAt: message.createdAt
      })),
      calculatedTotals: totalFromMessages
    });
  } catch (error) {
    console.error('Error retrieving thread token usage statistics:', error);
    logger.error(error, {
      action: 'get_thread_token_usage',
      threadId: params.id
    });
    
    return NextResponse.json(
      { error: 'Failed to retrieve token usage statistics' },
      { status: 500 }
    );
  }
} 