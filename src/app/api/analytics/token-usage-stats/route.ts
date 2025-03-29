import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { isUserAdmin } from '@/lib/permissions';
import { format, subDays, eachDayOfInterval } from 'date-fns';

// Define types for our response data
interface ProjectTokenUsage {
  id: string;
  name: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UserTokenUsage {
  id: string;
  name: string | null;
  email: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface DailyTokenUsage {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface TokenUsageStats {
  projectStats: ProjectTokenUsage[];
  userStats: UserTokenUsage[];
  dailyStats: DailyTokenUsage[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  tokenFieldsExist: boolean;
}

/**
 * Checks if the token usage columns exist in the database
 * @returns A boolean indicating if token usage columns exist
 */
async function checkTokenFieldsExist() {
  try {
    // Check if token fields exist in the database by querying the information schema
    const columnCheck = await prisma.$queryRaw`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name IN ('promptTokens', 'completionTokens', 'totalTokens')
      AND table_name IN ('Project', 'Thread', 'Message');
    `;
    
    return (columnCheck as any[]).length > 0;
  } catch (error) {
    console.error('Error checking token fields:', error);
    return false;
  }
}

/**
 * GET /api/analytics/token-usage-stats
 * 
 * Returns token usage statistics from the database.
 * 
 * Query parameters:
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
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    // Process date parameters or use defaults (last 30 days)
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    // Adjust end date to include the full day
    endDate.setHours(23, 59, 59, 999);

    // Check if token fields exist in the database
    const tokenFieldsExist = await checkTokenFieldsExist();
    
    if (!tokenFieldsExist) {
      // If token fields don't exist, return empty data with tokenFieldsExist=false
      return NextResponse.json({
        projectStats: [],
        userStats: [],
        dailyStats: [],
        totalUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        tokenFieldsExist: false,
      } as TokenUsageStats);
    }

    // Initialize data structures
    let projectStats: ProjectTokenUsage[] = [];
    let userStats: UserTokenUsage[] = [];
    let dailyStats: DailyTokenUsage[] = [];

    try {
      // Get token usage by project - using raw SQL to avoid TypeScript issues
      const projectsRaw = await prisma.$queryRaw`
        SELECT id, name, 
          COALESCE("promptTokens", 0)::int as "promptTokens", 
          COALESCE("completionTokens", 0)::int as "completionTokens", 
          COALESCE("totalTokens", 0)::int as "totalTokens"
        FROM "Project"
        WHERE "updatedAt" >= ${startDate} 
          AND "updatedAt" <= ${endDate}
          AND ("promptTokens" IS NOT NULL 
            OR "completionTokens" IS NOT NULL 
            OR "totalTokens" IS NOT NULL)
        ORDER BY "totalTokens" DESC NULLS LAST
      `;
      
      projectStats = (projectsRaw as any[]).map(p => ({
        id: p.id,
        name: p.name,
        promptTokens: Number(p.promptTokens) || 0,
        completionTokens: Number(p.completionTokens) || 0,
        totalTokens: Number(p.totalTokens) || 0
      }));
    } catch (err) {
      console.error('Error fetching project token usage:', err);
      // Continue with empty project stats
      projectStats = [];
    }

    // Create a map to store user token usage
    const userUsageMap = new Map<string, UserTokenUsage>();

    try {
      // Use raw SQL for threads query as well
      const threadsRaw = await prisma.$queryRaw`
        SELECT t.id, t."projectId", 
          COALESCE(t."promptTokens", 0)::int AS prompt_tokens, 
          COALESCE(t."completionTokens", 0)::int AS completion_tokens, 
          COALESCE(t."totalTokens", 0)::int AS total_tokens,
          p."createdById", u.id AS user_id, u.name, u.email
        FROM "Thread" t
        JOIN "Project" p ON t."projectId" = p.id
        JOIN "User" u ON p."createdById" = u.id
        WHERE t."updatedAt" >= ${startDate} 
          AND t."updatedAt" <= ${endDate}
          AND (t."promptTokens" IS NOT NULL 
            OR t."completionTokens" IS NOT NULL 
            OR t."totalTokens" IS NOT NULL)
      `;
      
      // Process threads to calculate user token usage
      for (const thread of threadsRaw as any[]) {
        const userId = thread.user_id;
        const threadPromptTokens = Number(thread.prompt_tokens) || 0;
        const threadCompletionTokens = Number(thread.completion_tokens) || 0;
        const threadTotalTokens = Number(thread.total_tokens) || 0;
        
        if (!userUsageMap.has(userId)) {
          userUsageMap.set(userId, {
            id: userId,
            name: thread.name,
            email: thread.email,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          });
        }
        
        const userUsage = userUsageMap.get(userId)!;
        userUsage.promptTokens += threadPromptTokens;
        userUsage.completionTokens += threadCompletionTokens;
        userUsage.totalTokens += threadTotalTokens;
      }

      // Convert the map to an array and sort by total tokens
      userStats = Array.from(userUsageMap.values())
        .sort((a, b) => b.totalTokens - a.totalTokens);
    } catch (err) {
      console.error('Error fetching user token usage from threads:', err);
      // Continue with empty user stats
      userStats = [];
    }

    // Calculate daily token usage
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyUsageMap = new Map<string, DailyTokenUsage>();
    
    // Initialize the map with all days in the range
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      dailyUsageMap.set(dateStr, {
        date: dateStr,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
    
    try {
      // Get messages with token usage within the date range - using raw SQL
      const messagesRaw = await prisma.$queryRaw`
        SELECT 
          DATE(m."createdAt") as date,
          SUM(COALESCE(m."promptTokens", 0)::int) as prompt_tokens,
          SUM(COALESCE(m."completionTokens", 0)::int) as completion_tokens,
          SUM(COALESCE(m."totalTokens", 0)::int) as total_tokens
        FROM "Message" m
        WHERE m."createdAt" >= ${startDate} 
          AND m."createdAt" <= ${endDate}
          AND (m."promptTokens" IS NOT NULL 
            OR m."completionTokens" IS NOT NULL 
            OR m."totalTokens" IS NOT NULL)
        GROUP BY DATE(m."createdAt")
        ORDER BY DATE(m."createdAt")
      `;
      
      // Aggregate message token usage by day
      for (const message of messagesRaw as any[]) {
        const dateStr = format(new Date(message.date), 'yyyy-MM-dd');
        
        if (!dailyUsageMap.has(dateStr)) {
          dailyUsageMap.set(dateStr, {
            date: dateStr,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          });
        }
        
        const dayStats = dailyUsageMap.get(dateStr)!;
        dayStats.promptTokens += Number(message.prompt_tokens) || 0;
        dayStats.completionTokens += Number(message.completion_tokens) || 0;
        dayStats.totalTokens += Number(message.total_tokens) || 0;
      }
    } catch (err) {
      console.error('Error fetching message token usage:', err);
      // We already initialized dailyUsageMap with empty values, so no need to do anything here
    }
    
    // Convert the map to an array and sort by date
    dailyStats = Array.from(dailyUsageMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate overall totals
    const totalUsage = {
      promptTokens: projectStats.reduce((sum, project) => sum + (project.promptTokens || 0), 0),
      completionTokens: projectStats.reduce((sum, project) => sum + (project.completionTokens || 0), 0),
      totalTokens: projectStats.reduce((sum, project) => sum + (project.totalTokens || 0), 0),
    };

    // Return the complete token usage statistics
    return NextResponse.json({
      projectStats,
      userStats,
      dailyStats,
      totalUsage,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      tokenFieldsExist: true,
    } as TokenUsageStats);
  } catch (error) {
    console.error('Error retrieving token usage statistics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token usage statistics' },
      { status: 500 }
    );
  }
} 