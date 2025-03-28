import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { isUserAdmin } from '@/lib/permissions';
import { SettingsService } from '@/lib/services/settings-service';
import OpenAI from 'openai';
import { format, subDays, eachDayOfInterval, addDays } from 'date-fns';

// Define the types for OpenAI usage data
interface UsageMetrics {
  total: {
    cost: number;
    tokens?: {
      input: number;
      output: number;
    };
    bytes?: number;
  };
  daily: {
    date: string;
    cost: number;
    tokens?: {
      input: number;
      output: number;
    };
    bytes?: number;
  }[];
}

interface UsageData {
  completions: UsageMetrics;
  embeddings: UsageMetrics;
  vectorStores: UsageMetrics;
  totalCost: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  isMockData?: boolean;
  mockReason?: string;
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

    // Log the date range for debugging
    console.log(`Date range: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);

    // First try to get the Admin API key which should have usage read permissions
    const adminApiKey = await SettingsService.getOpenAIAdminApiKey();
    
    // If admin API key is set, log that we're using it
    if (adminApiKey) {
      // Log a censored version of the admin API key for debugging
      const censoredKey = adminApiKey.substring(0, 3) + '...' + adminApiKey.substring(adminApiKey.length - 4);
      console.log(`Using OpenAI Admin API key: ${censoredKey}, length: ${adminApiKey.length}`);
    } else {
      // Admin key not set, try to get the regular API key
      console.log(`No Admin API key found, trying regular OpenAI API key`);
    }
    
    // Use admin key if available, otherwise try the regular API key
    const apiKey = adminApiKey || await SettingsService.getOpenAIApiKey();
    
    if (!apiKey) {
      console.log("No OpenAI API keys configured, using mock data");
      const mockUsageData = await generateMockUsageData(startDate, endDate);
      mockUsageData.mockReason = "no_api_key";
      return NextResponse.json(mockUsageData);
    }

    // Log which type of key we're using (without showing the actual key)
    console.log(`Using ${adminApiKey ? 'Admin' : 'Regular'} OpenAI API key for usage data`);
    
    // If using regular API key, warn about potential permission issues
    if (!adminApiKey) {
      console.log("WARNING: Using regular OpenAI API key for usage data - this may not have api.usage.read permission");
    }
    
    // Format dates for OpenAI API - convert to Unix timestamps
    const startTimeUnix = Math.floor(startDate.getTime() / 1000);
    const endTimeUnix = Math.floor(endDate.getTime() / 1000);
    console.log(`Unix timestamps: ${startTimeUnix} to ${endTimeUnix}`);

    // Initialize data structure for combined results
    const usageData: UsageData = {
      completions: { 
        total: { cost: 0, tokens: { input: 0, output: 0 } }, 
        daily: [] 
      },
      embeddings: { 
        total: { cost: 0, tokens: { input: 0, output: 0 } }, 
        daily: [] 
      },
      vectorStores: { 
        total: { cost: 0, bytes: 0 }, 
        daily: [] 
      },
      totalCost: 0,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      isMockData: false
    };

    // Verify that the API key has the necessary permissions
    const hasPermissions = await verifyApiKeyPermissions(apiKey);
    if (!hasPermissions) {
      console.log(`OpenAI API key doesn't have api.usage.read permission, using mock data`);
      const mockUsageData = await generateMockUsageData(startDate, endDate);
      mockUsageData.isMockData = true;
      mockUsageData.mockReason = "api_key_permission";
      return NextResponse.json(mockUsageData);
    }

    // Flag to track if any API call succeeds
    let anyApiCallSucceeded = false;
    
    try {
      // Use our new function to fetch all pages of data
      console.log("Fetching OpenAI usage data...");
      
      // Step 1: Fetch costs data
      console.log("Fetching costs data...");
      const costsSuccess = await fetchAllPages(
        "https://api.openai.com/v1/organization/costs",
        apiKey,
        startTimeUnix, 
        endTimeUnix,
        processCostsData,
        usageData
      );
      
      if (costsSuccess) {
        anyApiCallSucceeded = true;
        console.log("Successfully fetched costs data");
      } else {
        console.warn("Failed to fetch any costs data");
      }
      
      // Step 2: Fetch completions usage
      console.log("Fetching completions usage data...");
      const completionsSuccess = await fetchAllPages(
        "https://api.openai.com/v1/organization/usage/completions",
        apiKey,
        startTimeUnix, 
        endTimeUnix,
        processCompletionsData,
        usageData
      );
      
      if (completionsSuccess) {
        anyApiCallSucceeded = true;
        console.log("Successfully fetched completions usage data");
      } else {
        console.warn("Failed to fetch any completions usage data");
      }
      
      // Step 3: Fetch embeddings usage
      console.log("Fetching embeddings usage data...");
      const embeddingsSuccess = await fetchAllPages(
        "https://api.openai.com/v1/organization/usage/embeddings",
        apiKey,
        startTimeUnix, 
        endTimeUnix,
        processEmbeddingsData,
        usageData
      );
      
      if (embeddingsSuccess) {
        anyApiCallSucceeded = true;
        console.log("Successfully fetched embeddings usage data");
      } else {
        console.warn("Failed to fetch any embeddings usage data");
      }
      
      // Step 4: Fetch vector stores usage
      console.log("Fetching vector stores usage data...");
      const vectorStoresSuccess = await fetchAllPages(
        "https://api.openai.com/v1/organization/usage/vector_stores",
        apiKey,
        startTimeUnix, 
        endTimeUnix,
        processVectorStoresData,
        usageData
      );
      
      if (vectorStoresSuccess) {
        anyApiCallSucceeded = true;
        console.log("Successfully fetched vector stores usage data");
      } else {
        console.warn("Failed to fetch any vector stores usage data");
      }

      // If all API calls failed, use mock data instead
      if (!anyApiCallSucceeded) {
        console.log("All OpenAI API calls failed, falling back to mock data");
        const mockUsageData = await generateMockUsageData(startDate, endDate, "api_error");
        return NextResponse.json(mockUsageData);
      }

      // Set mock data flag if any part of the data is missing
      if (!costsSuccess || !completionsSuccess || !embeddingsSuccess || !vectorStoresSuccess) {
        usageData.isMockData = true;
        usageData.mockReason = "partial_data";
        console.log("Some API calls failed, marking data as partially mocked");
      }

      return NextResponse.json(usageData);
    } catch (apiError: any) {
      console.error("Error calling OpenAI API:", apiError);
      
      // Check for specific error types
      const errorMessage = apiError.message || '';
      
      // Check for specific permission errors in the exception
      if (errorMessage.includes("insufficient permissions") ||
          errorMessage.includes("api.usage.read") ||
          errorMessage.includes("Missing scopes")) {
        console.warn("OpenAI API key permission error detected:", errorMessage);
        const mockUsageData = await generateMockUsageData(startDate, endDate, "api_key_permission");
        return NextResponse.json(mockUsageData);
      }
      
      // Check for rate limiting
      if (errorMessage.includes("rate limit") || 
          errorMessage.includes("too many requests") ||
          apiError.status === 429) {
        console.warn("OpenAI API rate limit error detected:", errorMessage);
        const mockUsageData = await generateMockUsageData(startDate, endDate, "rate_limit");
        return NextResponse.json(mockUsageData);
      }
      
      // Fallback to mock data if API calls fail
      console.log("Falling back to mock data due to API error");
      const mockUsageData = await generateMockUsageData(startDate, endDate, "api_exception");
      return NextResponse.json(mockUsageData);
    }
  } catch (error: any) {
    console.error('OpenAI usage API error:', error);
    
    // Always fallback to mock data for any error
    console.log("Error in route handler, generating mock data");
    try {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();
      const mockUsageData = await generateMockUsageData(startDate, endDate, "route_error");
      return NextResponse.json(mockUsageData);
    } catch (mockError) {
      console.error("Failed to generate mock data:", mockError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch or generate OpenAI usage data',
          message: error.message || 'An unexpected error occurred'
        },
        { status: 500 }
      );
    }
  }
}

// Process costs data from OpenAI
function processCostsData(data: any, usageData: UsageData) {
  if (!data || data.object !== 'page' || !data.data || !Array.isArray(data.data)) {
    console.warn("Unexpected costs data format:", data);
    return;
  }
  
  // Create a map of date buckets
  const dateMap: Record<string, {
    completions: number;
    embeddings: number;
    vectorStores: number;
  }> = {};
  
  data.data.forEach((bucket: any) => {
    if (!bucket.results || !Array.isArray(bucket.results) || !bucket.start_time) {
      console.warn("Unexpected bucket format in costs data:", bucket);
      return;
    }
    
    bucket.results.forEach((result: any) => {
      // Convert unix timestamp to date string
      const date = new Date(bucket.start_time * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          completions: 0,
          embeddings: 0,
          vectorStores: 0
        };
      }
      
      // The amount can be either directly in amount.value or as a property
      const amount = result.amount?.value || result.amount || 0;
      
      // Add to the appropriate category based on available info
      // Since the detailed line_item might be null in some responses,
      // we'll aggregate all costs into "completions" for now
      dateMap[dateStr].completions += amount;
      usageData.completions.total.cost += amount;
      
      // Add to total cost
      usageData.totalCost += amount;
    });
  });
  
  // If there's pagination (has_more is true), we should ideally fetch more pages
  // but for now we'll just log that there's more data
  if (data.has_more && data.next_page) {
    console.log(`Note: There are more cost data pages available (next_page: ${data.next_page})`);
  }
  
  // Convert dateMap to daily arrays
  Object.entries(dateMap).forEach(([date, values]) => {
    usageData.completions.daily.push({ 
      date, 
      cost: values.completions,
      tokens: { input: 0, output: 0 } // Will be updated from completions data
    });
    
    usageData.embeddings.daily.push({ 
      date, 
      cost: 0, // We'll update this if we have specific embedding cost data
      tokens: { input: 0, output: 0 } // Will be updated from embeddings data
    });
    
    usageData.vectorStores.daily.push({ 
      date, 
      cost: 0, // We'll keep this for backward compatibility
      bytes: 0 // But we might not have this data anymore
    });
  });
}

// Process completions data from OpenAI
function processCompletionsData(data: any, usageData: UsageData) {
  if (!data || data.object !== 'page' || !data.data || !Array.isArray(data.data)) {
    console.warn("Unexpected completions data format:", data);
    return;
  }
  
  // Create a map for token usage by date
  const tokenMap: Record<string, {
    input: number;
    output: number;
  }> = {};
  
  data.data.forEach((bucket: any) => {
    if (!bucket.results || !Array.isArray(bucket.results) || !bucket.start_time) {
      console.warn("Unexpected bucket format in completions data:", bucket);
      return;
    }
    
    bucket.results.forEach((result: any) => {
      // Convert unix timestamp to date string
      const date = new Date(bucket.start_time * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (!tokenMap[dateStr]) {
        tokenMap[dateStr] = {
          input: 0,
          output: 0
        };
      }
      
      // Add token usage
      const inputTokens = result.input_tokens || 0;
      const outputTokens = result.output_tokens || 0;
      
      tokenMap[dateStr].input += inputTokens;
      tokenMap[dateStr].output += outputTokens;
      
      // Add to total tokens
      if (usageData.completions.total.tokens) {
        usageData.completions.total.tokens.input += inputTokens;
        usageData.completions.total.tokens.output += outputTokens;
      }
    });
  });
  
  // If there's pagination (has_more is true), we should ideally fetch more pages
  if (data.has_more && data.next_page) {
    console.log(`Note: There are more completions data pages available (next_page: ${data.next_page})`);
  }
  
  // Update token data in the existing daily entries or create new ones
  Object.entries(tokenMap).forEach(([dateStr, tokens]) => {
    const existingEntry = usageData.completions.daily.find(
      entry => entry.date === dateStr
    );
    
    if (existingEntry && existingEntry.tokens) {
      existingEntry.tokens.input = tokens.input;
      existingEntry.tokens.output = tokens.output;
    } else {
      // If no entry exists for this date (e.g., if costs data didn't have this date)
      usageData.completions.daily.push({
        date: dateStr,
        cost: 0, // We don't have cost information here
        tokens: {
          input: tokens.input,
          output: tokens.output
        }
      });
    }
  });
}

// Process embeddings data from OpenAI
function processEmbeddingsData(data: any, usageData: UsageData) {
  if (!data || data.object !== 'page' || !data.data || !Array.isArray(data.data)) {
    console.warn("Unexpected embeddings data format:", data);
    return;
  }
  
  // Create a map for token usage by date
  const tokenMap: Record<string, number> = {};
  
  data.data.forEach((bucket: any) => {
    if (!bucket.results || !Array.isArray(bucket.results) || !bucket.start_time) {
      console.warn("Unexpected bucket format in embeddings data:", bucket);
      return;
    }
    
    bucket.results.forEach((result: any) => {
      // Convert unix timestamp to date string
      const date = new Date(bucket.start_time * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (!tokenMap[dateStr]) {
        tokenMap[dateStr] = 0;
      }
      
      // For embeddings, there's only input tokens
      const inputTokens = result.input_tokens || 0;
      tokenMap[dateStr] += inputTokens;
      
      // Add to total tokens
      if (usageData.embeddings.total.tokens) {
        usageData.embeddings.total.tokens.input += inputTokens;
      }
    });
  });
  
  // If there's pagination (has_more is true), we should ideally fetch more pages
  if (data.has_more && data.next_page) {
    console.log(`Note: There are more embeddings data pages available (next_page: ${data.next_page})`);
  }
  
  // Update token data in the existing daily entries or create new ones
  Object.entries(tokenMap).forEach(([dateStr, inputTokens]) => {
    const existingEntry = usageData.embeddings.daily.find(
      entry => entry.date === dateStr
    );
    
    if (existingEntry && existingEntry.tokens) {
      existingEntry.tokens.input = inputTokens;
    } else {
      // If no entry exists for this date
      usageData.embeddings.daily.push({
        date: dateStr,
        cost: 0, // We don't have cost information here
        tokens: {
          input: inputTokens,
          output: 0 // Embeddings don't have output tokens
        }
      });
    }
  });
}

// Process vector stores data from OpenAI
function processVectorStoresData(data: any, usageData: UsageData) {
  if (!data || data.object !== 'page' || !data.data || !Array.isArray(data.data)) {
    console.warn("Unexpected vector stores data format:", data);
    return;
  }
  
  // Create a map for bytes usage by date
  const bytesMap: Record<string, number> = {};
  
  data.data.forEach((bucket: any) => {
    if (!bucket.results || !Array.isArray(bucket.results) || !bucket.start_time) {
      console.warn("Unexpected bucket format in vector stores data:", bucket);
      return;
    }
    
    bucket.results.forEach((result: any) => {
      // Convert unix timestamp to date string
      const date = new Date(bucket.start_time * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (!bytesMap[dateStr]) {
        bytesMap[dateStr] = 0;
      }
      
      // Add bytes usage
      const usageBytes = result.usage_bytes || 0;
      bytesMap[dateStr] += usageBytes;
      
      // Add to total bytes
      if (usageData.vectorStores.total.bytes !== undefined) {
        usageData.vectorStores.total.bytes += usageBytes;
      }
    });
  });
  
  // If there's pagination (has_more is true), we should ideally fetch more pages
  if (data.has_more && data.next_page) {
    console.log(`Note: There are more vector stores data pages available (next_page: ${data.next_page})`);
  }
  
  // Update bytes data in the existing daily entries or create new ones
  Object.entries(bytesMap).forEach(([dateStr, bytes]) => {
    const existingEntry = usageData.vectorStores.daily.find(
      entry => entry.date === dateStr
    );
    
    if (existingEntry) {
      existingEntry.bytes = bytes;
    } else {
      // If no entry exists for this date
      usageData.vectorStores.daily.push({
        date: dateStr,
        cost: 0, // We don't have cost information here
        bytes: bytes
      });
    }
  });
}

// Helper function to generate mock data for development and testing
async function generateMockUsageData(startDate: Date, endDate: Date, reason: string = "fallback"): Promise<UsageData> {
  try {
    // Initialize the data structure
    const usageData: UsageData = {
      completions: { 
        total: { 
          cost: 0, 
          tokens: { input: 0, output: 0 } 
        }, 
        daily: [] 
      },
      embeddings: { 
        total: { 
          cost: 0, 
          tokens: { input: 0, output: 0 } 
        }, 
        daily: [] 
      },
      vectorStores: { 
        total: { 
          cost: 0, 
          bytes: 0 
        }, 
        daily: [] 
      },
      totalCost: 0,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      isMockData: true,
      mockReason: reason
    } as UsageData;
    
    // Validate date range - ensure startDate is before endDate
    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }
    
    // Limit the date range to maximum 30 days to avoid performance issues
    if (endDate.getTime() - startDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get all days in the interval
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Generate realistic looking mock data for each day
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Generate random costs with realistic patterns
      // Weekends have less usage
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const multiplier = isWeekend ? 0.4 : 1;
      
      // Create some randomness but with a trend (more recent days have slightly higher usage)
      const daysSinceStart = Math.floor((day.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const trendFactor = 1 + (daysSinceStart * 0.02);
      
      // Generate much more realistic and lower costs (< $1 per day)
      const completionsCost = +(Math.random() * 0.3 * multiplier * trendFactor).toFixed(2);
      const embeddingsCost = +(Math.random() * 0.15 * multiplier * trendFactor).toFixed(2);
      const vectorStoresCost = +(Math.random() * 0.08 * multiplier * trendFactor).toFixed(2);
      
      // Generate token and bytes usage
      const inputTokens = Math.floor(Math.random() * 10000 * multiplier * trendFactor);
      const outputTokens = Math.floor(inputTokens * 0.7); // Output tokens are typically less than input
      const embeddingTokens = Math.floor(Math.random() * 5000 * multiplier * trendFactor);
      const storageBytes = Math.floor(Math.random() * 50000 * multiplier * trendFactor);
      
      // Add daily data
      usageData.completions.daily.push({ 
        date: dateStr, 
        cost: completionsCost,
        tokens: { input: inputTokens, output: outputTokens }
      });
      
      usageData.embeddings.daily.push({ 
        date: dateStr, 
        cost: embeddingsCost,
        tokens: { input: embeddingTokens, output: 0 }
      });
      
      usageData.vectorStores.daily.push({ 
        date: dateStr, 
        cost: vectorStoresCost,
        bytes: storageBytes
      });
      
      // Update totals
      usageData.completions.total.cost += completionsCost;
      usageData.embeddings.total.cost += embeddingsCost;
      usageData.vectorStores.total.cost += vectorStoresCost;
      usageData.totalCost += completionsCost + embeddingsCost + vectorStoresCost;
      
      // Update total tokens and bytes
      if (usageData.completions.total.tokens) {
        usageData.completions.total.tokens.input += inputTokens;
        usageData.completions.total.tokens.output += outputTokens;
      }
      
      if (usageData.embeddings.total.tokens) {
        usageData.embeddings.total.tokens.input += embeddingTokens;
      }
      
      if (usageData.vectorStores.total.bytes !== undefined) {
        usageData.vectorStores.total.bytes += storageBytes;
      }
    });
    
    // Round the totals to 2 decimal places
    usageData.completions.total.cost = +usageData.completions.total.cost.toFixed(2);
    usageData.embeddings.total.cost = +usageData.embeddings.total.cost.toFixed(2);
    usageData.vectorStores.total.cost = +usageData.vectorStores.total.cost.toFixed(2);
    usageData.totalCost = +usageData.totalCost.toFixed(2);
    
    // Sort daily data by date
    usageData.completions.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    usageData.embeddings.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    usageData.vectorStores.daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return usageData;
  } catch (error) {
    console.error("Error generating mock data:", error);
    
    // Fallback to even simpler mock data if anything goes wrong
    return {
      completions: { 
        total: { cost: 1.23, tokens: { input: 5000, output: 3500 } }, 
        daily: [{ date: format(new Date(), 'yyyy-MM-dd'), cost: 1.23, tokens: { input: 5000, output: 3500 } }]
      },
      embeddings: { 
        total: { cost: 0.45, tokens: { input: 2000, output: 0 } }, 
        daily: [{ date: format(new Date(), 'yyyy-MM-dd'), cost: 0.45, tokens: { input: 2000, output: 0 } }]
      },
      vectorStores: { 
        total: { cost: 0.10, bytes: 10000 }, 
        daily: [{ date: format(new Date(), 'yyyy-MM-dd'), cost: 0.10, bytes: 10000 }]
      },
      totalCost: 1.78,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      isMockData: true,
      mockReason: reason || "generation_error"
    } as UsageData;
  }
}

// Function to fetch all pages of a particular usage endpoint with improved pagination handling
async function fetchAllPages(
  baseUrl: string, 
  apiKey: string, 
  startTime: number, 
  endTime: number,
  processor: (data: any, usageData: UsageData) => void,
  usageData: UsageData,
  maxPages: number = 5 // Limit the number of pages to prevent excessive API calls
): Promise<boolean> {
  let nextPage: string | null = null;
  let pageCount = 0;
  let success = false;
  
  try {
    // Store the original query parameters for the first request
    const originalQueryParams = new URLSearchParams();
    originalQueryParams.append('start_time', startTime.toString());
    originalQueryParams.append('end_time', endTime.toString());
    
    // Add additional parameters based on endpoint type
    if (baseUrl.includes('/costs')) {
      // For costs endpoint 
      originalQueryParams.append('bucket_width', '1d');
      originalQueryParams.append('limit', '31'); // Get maximum daily buckets for 1d
    } else if (baseUrl.includes('/completions')) {
      // For completions endpoint
      originalQueryParams.append('bucket_width', '1d');
      originalQueryParams.append('limit', '31'); // Get maximum daily buckets for 1d
    } else if (baseUrl.includes('/embeddings')) {
      // For embeddings endpoint
      originalQueryParams.append('bucket_width', '1d');
      originalQueryParams.append('limit', '31'); // Get maximum daily buckets for 1d
    } else if (baseUrl.includes('/vector_stores')) {
      // For vector stores endpoint
      originalQueryParams.append('bucket_width', '1d');
      originalQueryParams.append('limit', '31'); // Get maximum daily buckets for 1d
    }
    
    // Initial URL with parameters
    let url = `${baseUrl}?${originalQueryParams.toString()}`;
    
    do {
      // For subsequent pages, use only the page parameter
      if (nextPage) {
        url = `${baseUrl}?page=${encodeURIComponent(nextPage)}`;
      }
      
      console.log(`Fetching data from: ${url}`);
      
      // Add a small delay to avoid hitting rate limits
      if (pageCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay to 1 second
      }
      
      // Make the API request with consistent headers
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store' // Ensure we're not getting cached responses
      });
      
      // Log response status for debugging
      console.log(`Response status from ${baseUrl.split('/').pop()}: ${response.status}`);
      
      if (!response.ok) {
        // Get the response text for error debugging
        const errorText = await response.text();
        console.log(`Error response from ${baseUrl.split('/').pop()}: ${errorText}`);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error(`Error fetching ${baseUrl}:`, errorData);
        } catch (e) {
          console.error(`Error fetching ${baseUrl}, status: ${response.status}, response: ${errorText}`);
        }
        return success;
      }
      
      // Parse the response JSON
      const data = await response.json();
      
      // Log truncated response for debugging
      console.log(`Got data for ${baseUrl.split('/').pop()}, structure:`, 
        JSON.stringify(data).substring(0, 200) + '...');
      
      // Process this page of data
      processor(data, usageData);
      success = true;
      
      // Get the next page token
      nextPage = data.next_page || null;
      pageCount++;
      
      // Log pagination information
      if (pageCount === 1) {
        console.log(`Fetched first page of ${baseUrl}, has_more: ${data.has_more || false}, next_page: ${nextPage || 'none'}`);
      }
      
    } while (nextPage && pageCount < maxPages);
    
    // If we hit the page limit, log a warning
    if (nextPage && pageCount >= maxPages) {
      console.warn(`Reached maximum page count (${maxPages}) for ${baseUrl}. Some data may be missing.`);
    }
    
    return success;
  } catch (error) {
    console.error(`Error in fetchAllPages for ${baseUrl}:`, error);
    return success;
  }
}

// Function to verify OpenAI API key has api.usage.read permission
async function verifyApiKeyPermissions(apiKey: string): Promise<boolean> {
  try {
    // Attempt to fetch a minimal amount of data to check permissions
    const currentTime = Math.floor(Date.now() / 1000);
    const oneDayAgo = currentTime - (24 * 60 * 60);
    
    // Try to access the costs endpoint with a limit of 1
    console.log("Verifying API key permissions by testing costs endpoint...");
    
    const response = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${oneDayAgo}&end_time=${currentTime}&limit=1`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Log the status code for debugging
    console.log(`Permission check response status: ${response.status}`);
    
    if (!response.ok) {
      const statusCode = response.status;
      
      const errorText = await response.text();
      console.log(`Permission check error response: ${errorText}`);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.error("Unable to parse error response:", errorText);
        return false;
      }
      
      // Check specifically for permissions error
      if (statusCode === 403 || statusCode === 401) {
        const errorMessage = errorData?.error?.message || '';
        console.warn(`API key access denied: ${errorMessage}`);
        
        if (errorMessage.includes("insufficient permissions") || 
            errorMessage.includes("api.usage.read") ||
            errorMessage.includes("Missing scopes") ||
            errorMessage.includes("permission")) {
          console.warn("OpenAI API key is missing the 'api.usage.read' scope");
        } else {
          console.warn("API key authorization failed with message:", errorMessage);
        }
        return false;
      }
      
      // Other API errors
      console.error("API key permission check failed with non-auth error:", errorData);
      return false;
    }
    
    // Basic validation of the response structure
    try {
      const data = await response.json();
      console.log("Permission check response data structure:", JSON.stringify(data).substring(0, 200) + '...');
      
      if (!data || data.object !== 'page' || !Array.isArray(data.data)) {
        console.warn("API key has unexpected response format:", data);
        return false;
      }
      
      // If we got here, the key has the needed permissions
      console.log("API key has the required permissions for usage data");
      return true;
    } catch (parseError) {
      console.error("Error parsing API permission check response:", parseError);
      return false;
    }
  } catch (error) {
    console.error("Error checking API key permissions:", error);
    return false;
  }
} 