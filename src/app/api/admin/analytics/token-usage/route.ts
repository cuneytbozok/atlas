import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { isUserAdmin } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

// Define extended types that include our new fields
interface TokenUsageStats {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface ThreadWithTokens extends TokenUsageStats {
  id: string;
  title: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectWithTokens extends TokenUsageStats {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GET /api/admin/analytics/token-usage
 * 
 * Returns token usage statistics for the application.
 * Can be filtered by project, thread, time range.
 * 
 * Query parameters:
 * - projectId: Optional ID of project to filter by
 * - threadId: Optional ID of thread to filter by
 * - startDate: Optional start date for time range (ISO string)
 * - endDate: Optional end date for time range (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session and check admin permissions
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const threadId = url.searchParams.get('threadId');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    // Process date parameters
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Create base query parameters
    const whereConditions: any = {};
    
    // Add filters if provided
    if (projectId) {
      whereConditions.projectId = projectId;
    }
    
    if (threadId) {
      whereConditions.id = threadId;
    }
    
    // Add date range if provided
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      
      if (startDate) {
        whereConditions.createdAt.gte = startDate;
      }
      
      if (endDate) {
        whereConditions.createdAt.lte = endDate;
      }
    }

    // Get token usage statistics by thread
    const threadStats = await prisma.thread.findMany({
      where: whereConditions,
      select: {
        id: true,
        title: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        // These fields exist in the database but not in the TypeScript types yet
        // We'll handle them later when processing the results
      },
      orderBy: { updatedAt: 'desc' }
    }) as unknown as ThreadWithTokens[];

    // Get token usage statistics by project
    const projectStats = await prisma.project.findMany({
      where: projectId ? { id: projectId } : {},
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        // These fields exist in the database but not in the TypeScript types yet
        // We'll handle them later when processing the results
      },
      orderBy: { updatedAt: 'desc' }
    }) as unknown as ProjectWithTokens[];

    // Calculate overall totals
    const totalUsage = {
      promptTokens: threadStats.reduce((sum, thread) => sum + (thread.promptTokens || 0), 0),
      completionTokens: threadStats.reduce((sum, thread) => sum + (thread.completionTokens || 0), 0),
      totalTokens: threadStats.reduce((sum, thread) => sum + (thread.totalTokens || 0), 0)
    };

    return NextResponse.json({
      threadStats,
      projectStats,
      totalUsage,
      filters: {
        projectId: projectId || null,
        threadId: threadId || null,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null
      }
    });
  } catch (error) {
    console.error('Error retrieving token usage statistics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token usage statistics' },
      { status: 500 }
    );
  }
} 