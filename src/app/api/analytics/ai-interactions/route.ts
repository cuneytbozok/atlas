import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/ai-interactions
 * 
 * Returns the total count of AI assistant messages across all projects the user has access to.
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session and check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Find all projects the user has access to
    const userProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true }
    });

    const projectIds = userProjects.map(member => member.projectId);

    // Get all threads from these projects
    const threads = await prisma.thread.findMany({
      where: {
        projectId: { in: projectIds }
      },
      select: { id: true }
    });

    const threadIds = threads.map(thread => thread.id);

    // Count all assistant messages across all these threads
    const totalAssistantMessages = await prisma.message.count({
      where: {
        threadId: { in: threadIds },
        role: 'assistant'
      }
    });

    return NextResponse.json({
      total: totalAssistantMessages
    });
  } catch (error) {
    console.error('Error fetching total AI interactions:', error);
    logger.error(error, {
      action: 'get_total_ai_interactions'
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch total AI interactions' },
      { status: 500 }
    );
  }
} 