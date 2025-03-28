import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { isUserAdmin } from '@/lib/permissions';

// Define types for our data structures
interface ProjectWithMessages {
  id: string;
  name: string;
  messageCount: number;
  threadCount: number;
}

interface UserActivity {
  id: string;
  name: string;
  email: string;
  messageCount: number;
}

interface DailyTrend {
  date: string;
  messageCount: number;
}

// Input schema for date range
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // Check authentication using getServerSession
    const session = await getServerSession(authOptions);
    
    // Log session information for debugging
    console.log("Analytics API - Session:", {
      exists: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        roles: session.user.roles
      } : null
    });
    
    if (!session?.user) {
      console.log("Analytics API - Unauthorized: No valid session");
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'You must be logged in to access analytics data'
      }, { status: 401 });
    }

    // Using session user id for permissions
    const userId = session.user.id;
    
    // Check if user has admin role directly from session
    const hasAdminRole = session.user.roles?.includes('ADMIN');
    
    // If not in session, check via database
    if (!hasAdminRole) {
      console.log("Analytics API - Checking admin status via database for user:", userId);
      const isAdmin = await isUserAdmin(userId);
      
      if (!isAdmin) {
        console.log("Analytics API - Forbidden: User is not an admin");
        return NextResponse.json({ 
          error: 'Forbidden', 
          message: 'Admin access required to view analytics data'
        }, { status: 403 });
      }
    }
    
    console.log("Analytics API - User is authenticated and authorized");

    // Get date range from URL params
    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parse and validate date range
    const dateRange = dateRangeSchema.parse({
      startDate: startDateParam || undefined,
      endDate: endDateParam || undefined,
    });

    // Set default date range if not provided (last 7 days)
    const endDate = dateRange.endDate 
      ? new Date(dateRange.endDate) 
      : new Date();
    
    const startDate = dateRange.startDate 
      ? new Date(dateRange.startDate) 
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get most active projects (projects with most messages)
    const activeProjects = await prisma.project.findMany({
      where: {
        threads: {
          some: {
            messages: {
              some: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            threads: {
              where: {
                messages: {
                  some: {
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
        threads: {
          select: {
            _count: {
              select: {
                messages: {
                  where: {
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        threads: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    // Calculate total messages for each project
    const projectsWithMessageCount: ProjectWithMessages[] = activeProjects.map(project => {
      const totalMessages = project.threads.reduce(
        (acc, thread) => acc + thread._count.messages, 
        0
      );
      
      return {
        id: project.id,
        name: project.name,
        messageCount: totalMessages,
        threadCount: project._count.threads,
      };
    }).sort((a, b) => b.messageCount - a.messageCount);

    // Get most active users (users who sent the most messages)
    const messagesByUser = await prisma.message.groupBy({
      by: ['threadId'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        role: 'user', // Only count user messages
      },
      _count: {
        _all: true,
      },
    });

    // Get threads with their project and project members to associate messages with users
    const threadsWithProjects = await prisma.thread.findMany({
      where: {
        id: {
          in: messagesByUser.map(m => m.threadId),
        },
      },
      include: {
        project: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
            createdBy: true,
          },
        },
      },
    });

    // Map threads to their primary users (project creator or first member)
    const threadToUserMap: Record<string, any> = {};
    threadsWithProjects.forEach(thread => {
      if (thread.project) {
        threadToUserMap[thread.id] = thread.project.createdBy;
      }
    });

    // Aggregate message counts by user
    const userMessageCounts: Record<string, UserActivity> = {};
    messagesByUser.forEach(message => {
      const user = threadToUserMap[message.threadId];
      if (user) {
        if (!userMessageCounts[user.id]) {
          userMessageCounts[user.id] = {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            messageCount: 0,
          };
        }
        userMessageCounts[user.id].messageCount += message._count._all;
      }
    });

    // Convert to array and sort by message count
    const activeUsers = Object.values(userMessageCounts)
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);

    // Get daily message counts for trend data
    const dailyTrends = await prisma.message.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        _all: true,
      },
    });

    // Aggregate message counts by day
    const dailyCounts: Record<string, number> = {};
    dailyTrends.forEach(record => {
      const date = new Date(record.createdAt).toISOString().split('T')[0];
      if (!dailyCounts[date]) {
        dailyCounts[date] = 0;
      }
      dailyCounts[date] += record._count._all;
    });

    // Convert to array of daily data points
    const trendData: DailyTrend[] = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      messageCount: count,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      activeProjects: projectsWithMessageCount,
      activeUsers,
      dailyTrends: trendData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 