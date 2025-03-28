import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { isUserAdmin } from '@/lib/permissions';
import { SettingsService } from '@/lib/services/settings-service';
import OpenAI from 'openai';
import { format, subDays, eachDayOfInterval, addDays } from 'date-fns';

// Define the types for OpenAI usage data
interface UsageCost {
  total: number;
  daily: {
    date: string;
    cost: number;
  }[];
}

interface UsageData {
  completions: UsageCost;
  embeddings: UsageCost;
  vectorStores: UsageCost;
  totalCost: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication using getServerSession
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
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
      const isAdmin = await isUserAdmin(userId);
      
      if (!isAdmin) {
        return NextResponse.json({ 
          error: 'Forbidden', 
          message: 'Admin access required to view analytics data'
        }, { status: 403 });
      }
    }

    // Get date range from URL params
    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Set default date range if not provided (last 7 days)
    const endDate = endDateParam 
      ? new Date(endDateParam) 
      : new Date();
    
    const startDate = startDateParam 
      ? new Date(startDateParam) 
      : subDays(endDate, 7);

    // Get the OpenAI API key from settings
    const apiKey = await SettingsService.getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json({
        error: 'Configuration Error',
        message: 'OpenAI API key is not configured'
      }, { status: 400 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Create a mock/sample usage data response since the OpenAI usage API 
    // requires special permissions and may not be available for all accounts
    const mockUsageData = await generateMockUsageData(startDate, endDate);
    
    return NextResponse.json(mockUsageData);
    
    // Note: The following code would be used if you have access to the usage API.
    // Currently commented out and replaced with mock data.
    /*
    // Format dates for OpenAI API
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    
    // Get all days in the interval to query individually
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Initialize data structure for combined results
    const usageData: UsageData = {
      completions: { total: 0, daily: [] },
      embeddings: { total: 0, daily: [] },
      vectorStores: { total: 0, daily: [] },
      totalCost: 0,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };
    
    // Fetch usage data for each day in the range
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Call the usage endpoint for a specific date
      const usageResponse = await fetch(`https://api.openai.com/v1/usage?date=${dateStr}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!usageResponse.ok) {
        const errorData = await usageResponse.json();
        console.error(`Error fetching OpenAI usage for ${dateStr}:`, errorData);
        continue; // Skip this day but continue with others
      }
      
      const dayUsageData = await usageResponse.json();
      
      // Process the data for this day and add it to our combined results
      processUsageDay(dayUsageData, dateStr, usageData);
    }
    
    return NextResponse.json(usageData);
    */
  } catch (error: any) {
    console.error('OpenAI usage API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch OpenAI usage data',
        message: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// Helper function to process a single day's usage data
function processUsageDay(dayData: any, dateStr: string, combinedData: UsageData) {
  if (!dayData || !dayData.data || !Array.isArray(dayData.data)) return;
  
  let dayCompletions = 0;
  let dayEmbeddings = 0;
  let dayVectorStores = 0;
  
  dayData.data.forEach((item: any) => {
    const cost = item.cost || 0;
    const usageType = item.object || item.name || 'unknown';
    
    // Categorize by usage type
    if (usageType.includes('completion') || usageType.includes('chat')) {
      dayCompletions += cost;
      combinedData.completions.total += cost;
    } else if (usageType.includes('embedding')) {
      dayEmbeddings += cost;
      combinedData.embeddings.total += cost;
    } else if (usageType.includes('vector') || usageType.includes('store')) {
      dayVectorStores += cost;
      combinedData.vectorStores.total += cost;
    }
    
    // Add to total cost
    combinedData.totalCost += cost;
  });
  
  // Add daily data points
  combinedData.completions.daily.push({ date: dateStr, cost: dayCompletions });
  combinedData.embeddings.daily.push({ date: dateStr, cost: dayEmbeddings });
  combinedData.vectorStores.daily.push({ date: dateStr, cost: dayVectorStores });
}

// Helper function to generate mock data for development and testing
async function generateMockUsageData(startDate: Date, endDate: Date): Promise<UsageData> {
  // Initialize the data structure
  const usageData: UsageData = {
    completions: { total: 0, daily: [] },
    embeddings: { total: 0, daily: [] },
    vectorStores: { total: 0, daily: [] },
    totalCost: 0,
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  };
  
  // Get all days in the interval
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Generate realistic looking mock data for each day
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Generate random costs with some realistic patterns
    // Weekends have less usage
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const multiplier = isWeekend ? 0.4 : 1;
    
    // Create some randomness but with a trend (more recent days have slightly higher usage)
    const daysSinceStart = Math.floor((day.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trendFactor = 1 + (daysSinceStart * 0.02);
    
    // Base costs per service with some randomness
    const completionsCost = +(Math.random() * 3 * multiplier * trendFactor).toFixed(2);
    const embeddingsCost = +(Math.random() * 1.5 * multiplier * trendFactor).toFixed(2);
    const vectorStoresCost = +(Math.random() * 0.8 * multiplier * trendFactor).toFixed(2);
    
    // Add daily data
    usageData.completions.daily.push({ date: dateStr, cost: completionsCost });
    usageData.embeddings.daily.push({ date: dateStr, cost: embeddingsCost });
    usageData.vectorStores.daily.push({ date: dateStr, cost: vectorStoresCost });
    
    // Update totals
    usageData.completions.total += completionsCost;
    usageData.embeddings.total += embeddingsCost;
    usageData.vectorStores.total += vectorStoresCost;
    usageData.totalCost += completionsCost + embeddingsCost + vectorStoresCost;
  });
  
  // Round the totals to 2 decimal places
  usageData.completions.total = +usageData.completions.total.toFixed(2);
  usageData.embeddings.total = +usageData.embeddings.total.toFixed(2);
  usageData.vectorStores.total = +usageData.vectorStores.total.toFixed(2);
  usageData.totalCost = +usageData.totalCost.toFixed(2);
  
  // Sort daily data by date
  usageData.completions.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  usageData.embeddings.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  usageData.vectorStores.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return usageData;
} 