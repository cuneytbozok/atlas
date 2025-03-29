import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { hasProjectAccess } from '@/lib/permissions';
import { logger } from '@/lib/logger';

// Define extended types that include our new fields
interface TokenUsageStats {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface ThreadWithTokens extends TokenUsageStats {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GET /api/projects/[id]/analytics/token-usage
 * 
 * Returns token usage statistics for a specific project.
 * Can be filtered by thread, time range.
 * 
 * Query parameters:
 * - threadId: Optional ID of thread to filter by
 * - startDate: Optional start date for time range (ISO string)
 * - endDate: Optional end date for time range (ISO string)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user session and check project access permissions
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

    // Parse query parameters
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    // Process date parameters
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Get project with token usage info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      }
    }) as any;

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create base thread query conditions
    const threadWhereConditions: any = {
      projectId
    };
    
    // Add thread filter if provided
    if (threadId) {
      threadWhereConditions.id = threadId;
    }
    
    // Add date range if provided
    if (startDate || endDate) {
      threadWhereConditions.createdAt = {};
      
      if (startDate) {
        threadWhereConditions.createdAt.gte = startDate;
      }
      
      if (endDate) {
        threadWhereConditions.createdAt.lte = endDate;
      }
    }

    // Get token usage statistics by thread
    const threadStats = await prisma.thread.findMany({
      where: threadWhereConditions,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' }
    }) as unknown as ThreadWithTokens[];

    // Calculate project totals (from the threads)
    const totalFromThreads = {
      promptTokens: threadStats.reduce((sum, thread) => sum + (thread.promptTokens || 0), 0),
      completionTokens: threadStats.reduce((sum, thread) => sum + (thread.completionTokens || 0), 0),
      totalTokens: threadStats.reduce((sum, thread) => sum + (thread.totalTokens || 0), 0)
    };

    // Return the project token usage and thread breakdowns
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        promptTokens: project.promptTokens || 0,
        completionTokens: project.completionTokens || 0,
        totalTokens: project.totalTokens || 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      threadStats,
      calculatedTotals: totalFromThreads,
      filters: {
        threadId: threadId || null,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null
      }
    });
  } catch (error) {
    console.error('Error retrieving project token usage statistics:', error);
    logger.error(error, {
      action: 'get_project_token_usage',
      projectId: params.id
    });
    
    return NextResponse.json(
      { error: 'Failed to retrieve token usage statistics' },
      { status: 500 }
    );
  }
} 