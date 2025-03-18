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
    // Access session first, before using params
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Now that we've awaited something, we can access params
    const threadId = params.id;
    const runId = params.runId;
    
    console.log(`[API] Checking run status for thread ${threadId}, run ${runId}, user ${userId}`);

    // Check if user has access to the thread's project
    const hasAccess = await hasThreadAccess(threadId, userId);
    if (!hasAccess) {
      console.log(`[API] User ${userId} does not have access to thread ${threadId}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(`[API] Calling ChatService.checkRunStatus for thread ${threadId}, run ${runId}`);
    const result = await ChatService.checkRunStatus(threadId, runId);
    console.log(`[API] Run status result: status=${result.status}, messages=${result.messages?.length || 0}`);
    
    return NextResponse.json(result);
  } catch (error) {
    const errorInfo = {
      action: 'check_run_status',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    logger.error(error, errorInfo);
    console.error(`[API] Error checking run status:`, error);
    
    return NextResponse.json(
      { error: 'Failed to check run status' },
      { status: 500 }
    );
  }
} 