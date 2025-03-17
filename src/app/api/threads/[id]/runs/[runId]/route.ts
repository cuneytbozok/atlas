import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ChatService } from '@/lib/services/chat-service';
import { hasThreadAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';

/**
 * GET /api/threads/[id]/runs/[runId]
 * Check the status of an assistant run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = params.id;
    const runId = params.runId;
    const userId = session.user.id;

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await ChatService.checkRunStatus(threadId, runId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(error, {
      action: 'check_run_status',
      threadId: params.id,
      runId: params.runId
    });
    
    return NextResponse.json(
      { error: 'Failed to check run status' },
      { status: 500 }
    );
  }
} 