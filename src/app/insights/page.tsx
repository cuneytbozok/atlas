"use client";

import { useState, useEffect, Suspense } from "react";
import { format, subDays } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { CalendarIcon, ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";

// Define types for analytics data
interface ProjectStats {
  id: string;
  name: string;
  messageCount: number;
  threadCount: number;
}

interface UserStats {
  id: string;
  name: string;
  email: string;
  messageCount: number;
}

interface DailyTrend {
  date: string;
  messageCount: number;
}

interface AnalyticsData {
  activeProjects: ProjectStats[];
  activeUsers: UserStats[];
  dailyTrends: DailyTrend[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// Add OpenAI usage data interfaces
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

interface OpenAIUsageData {
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

// Define types for our token usage data
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
  tokenFieldsExist?: boolean;
}

function InsightsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [openAIData, setOpenAIData] = useState<OpenAIUsageData | null>(null);
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpenAIDataLoading, setIsOpenAIDataLoading] = useState(true);
  const [isTokenUsageLoading, setIsTokenUsageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAIError, setOpenAIError] = useState<string | null>(null);
  const [tokenUsageError, setTokenUsageError] = useState<string | null>(null);
  
  // Check if user is admin
  const isAdmin = hasRole("ADMIN");
  
  // Redirect non-admin users to home
  useEffect(() => {
    if (!authLoading && isAuthenticated && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);
  
  // Parse date range from URL or use default (last 7 days)
  const startParam = searchParams?.get("startDate");
  const endParam = searchParams?.get("endDate");
  
  // This is the date range in the calendar (not yet applied)
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: startParam ? new Date(startParam) : subDays(new Date(), 7),
    endDate: endParam ? new Date(endParam) : new Date(),
  });
  
  // This is the applied date range that we'll use for data fetching
  const [appliedDateRange, setAppliedDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: startParam ? new Date(startParam) : subDays(new Date(), 7),
    endDate: endParam ? new Date(endParam) : new Date(),
  });
  
  // Date picker state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // State to track which date the user is selecting (start or end)
  const [selectionMode, setSelectionMode] = useState<'start' | 'end' | 'single'>('start');

  // Fetch analytics data
  useEffect(() => {
    // Skip fetching if not admin
    if (!isAdmin) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Format dates for API request
        const startDateStr = format(appliedDateRange.startDate, "yyyy-MM-dd");
        const endDateStr = format(appliedDateRange.endDate, "yyyy-MM-dd");
        
        const response = await fetch(
          `/api/analytics?startDate=${startDateStr}&endDate=${endDateStr}`
        );
        
        // Handle different status codes
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.message || `Error: HTTP ${response.status}`;
          
          if (response.status === 403) {
            throw new Error(`Access denied: ${errorMessage}`);
          } else if (response.status === 401) {
            throw new Error(`Authentication required: ${errorMessage}`);
          } else {
            throw new Error(`Error fetching analytics: ${errorMessage}`);
          }
        }
        
        const analyticsData = await response.json();
        setData(analyticsData);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch analytics data:", err);
        setError(err.message || "Failed to load analytics data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [appliedDateRange.startDate, appliedDateRange.endDate, isAdmin]);
  
  // Fetch OpenAI usage data
  useEffect(() => {
    // Skip fetching if not admin
    if (!isAdmin) return;
    
    const fetchOpenAIData = async () => {
      try {
        setIsOpenAIDataLoading(true);
        
        // Format dates for API request
        const startDateStr = format(appliedDateRange.startDate, "yyyy-MM-dd");
        let endDateStr = format(appliedDateRange.endDate, "yyyy-MM-dd");
        
        // If it's a single day selection, add 1 to the end date to ensure we get data
        const isOneDay = appliedDateRange.startDate.getTime() === appliedDateRange.endDate.getTime();
        if (isOneDay) {
          // Clone the date and add 1 day for the API call
          const nextDay = new Date(appliedDateRange.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          endDateStr = format(nextDay, "yyyy-MM-dd");
        }
        
        const response = await fetch(
          `/api/analytics/openai-usage?startDate=${startDateStr}&endDate=${endDateStr}`
        );
        
        // Handle different status codes
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.message || `Error: HTTP ${response.status}`;
          
          if (response.status === 403) {
            throw new Error(`Access denied: ${errorMessage}`);
          } else if (response.status === 401) {
            throw new Error(`Authentication required: ${errorMessage}`);
          } else {
            throw new Error(`Error fetching OpenAI usage data: ${errorMessage}`);
          }
        }
        
        const openAIUsageData = await response.json();
        
        // Check if we received valid OpenAI usage data
        if (!openAIUsageData || typeof openAIUsageData !== 'object') {
          console.warn("Received invalid OpenAI usage data format:", openAIUsageData);
          throw new Error("Invalid data format received from OpenAI usage API");
        }
        
        setOpenAIData(openAIUsageData);
        setOpenAIError(null);
      } catch (err: any) {
        console.error("Failed to fetch OpenAI usage data:", err);
        // Set a user-friendly error message
        setOpenAIError(
          "Could not load OpenAI usage data. This might be due to API key permission issues. " +
          "The API key needs the 'api.usage.read' scope. " +
          "Mock data may be displayed instead."
        );
      } finally {
        setIsOpenAIDataLoading(false);
      }
    };
    
    fetchOpenAIData();
  }, [appliedDateRange.startDate, appliedDateRange.endDate, isAdmin]);
  
  // Fetch Token Usage data from database
  useEffect(() => {
    // Skip fetching if not admin
    if (!isAdmin) return;
    
    const fetchTokenUsageData = async () => {
      try {
        setIsTokenUsageLoading(true);
        
        // Format dates for API request
        const startDateStr = format(appliedDateRange.startDate, "yyyy-MM-dd");
        let endDateStr = format(appliedDateRange.endDate, "yyyy-MM-dd");
        
        // If it's a single day selection, add 1 to the end date to ensure we get data
        const isOneDay = appliedDateRange.startDate.getTime() === appliedDateRange.endDate.getTime();
        if (isOneDay) {
          // Clone the date and add 1 day for the API call
          const nextDay = new Date(appliedDateRange.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          endDateStr = format(nextDay, "yyyy-MM-dd");
        }
        
        const response = await fetch(
          `/api/analytics/token-usage-stats?startDate=${startDateStr}&endDate=${endDateStr}`
        );
        
        // Handle different status codes
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.message || `Error: HTTP ${response.status}`;
          
          if (response.status === 403) {
            throw new Error(`Access denied: ${errorMessage}`);
          } else if (response.status === 401) {
            throw new Error(`Authentication required: ${errorMessage}`);
          } else {
            throw new Error(`Error fetching token usage data: ${errorMessage}`);
          }
        }
        
        const tokenUsageStats = await response.json();
        
        // Check if we received valid token usage data
        if (!tokenUsageStats || typeof tokenUsageStats !== 'object') {
          console.warn("Received invalid token usage data format:", tokenUsageStats);
          throw new Error("Invalid data format received from token usage API");
        }
        
        setTokenUsageData(tokenUsageStats);
        setTokenUsageError(null);
      } catch (err: any) {
        console.error("Failed to fetch token usage data:", err);
        setTokenUsageError(err.message || "Failed to load token usage data. Please try again later.");
      } finally {
        setIsTokenUsageLoading(false);
      }
    };
    
    fetchTokenUsageData();
  }, [appliedDateRange.startDate, appliedDateRange.endDate, isAdmin]);
  
  // Don't render page content for non-admin users
  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 max-w-7xl">
          <div className="flex justify-center p-12">
            <p className="text-lg">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 max-w-7xl">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <ShieldAlert className="h-12 w-12 text-red-500" />
              <h1 className="text-2xl font-bold">Access Denied</h1>
              <p className="text-muted-foreground">
                You don't have permission to access the insights page.
                Only administrators can view analytics data.
              </p>
              <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }
  
  // Update URL when date range changes
  const updateDateRange = (startDate: Date, endDate: Date) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("startDate", format(startDate, "yyyy-MM-dd"));
    params.set("endDate", format(endDate, "yyyy-MM-dd"));
    
    router.push(`/insights?${params.toString()}`);
    
    // Update both date ranges when applying - this is important
    setDateRange({ startDate, endDate });
    setAppliedDateRange({ startDate, endDate });
    setIsCalendarOpen(false);  // Close calendar after applying range
  };
  
  // Function to handle single day selection
  const handleSingleDaySelect = (date: Date) => {
    updateDateRange(date, date);
  };
  
  // Function to handle the "Last 7 Days" button click
  const handleLast7Days = () => {
    const end = new Date();
    const start = subDays(end, 7);
    setDateRange({ startDate: start, endDate: end });
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Insights</h1>
          
          {/* Date Range Selector */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {appliedDateRange.startDate.getTime() === appliedDateRange.endDate.getTime() 
                  ? format(appliedDateRange.startDate, "PPP") 
                  : `${format(appliedDateRange.startDate, "PPP")} - ${format(appliedDateRange.endDate, "PPP")}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              {/* Add tabs for date selection mode */}
              <div className="p-3 border-b border-muted">
                <div className="flex justify-center mb-2">
                  <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button 
                      type="button" 
                      className={`px-4 py-2 text-xs font-medium rounded-l-lg ${selectionMode === 'single' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary hover:bg-secondary/80'}`}
                      onClick={() => setSelectionMode('single')}
                    >
                      Single Day
                    </button>
                    <button 
                      type="button" 
                      className={`px-4 py-2 text-xs font-medium ${selectionMode === 'start' || selectionMode === 'end' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary hover:bg-secondary/80'}`}
                      onClick={() => setSelectionMode('start')}
                    >
                      Date Range
                    </button>
                  </div>
                </div>
                
                {/* Instructions based on selection mode */}
                <div className="text-xs text-muted-foreground text-center mt-1">
                  {selectionMode === 'single' 
                    ? "Select a single day for analysis"
                    : selectionMode === 'start'
                      ? <span className="font-medium text-primary">Select <strong>start</strong> date first</span>
                      : <span className="font-medium text-primary">Now select <strong>end</strong> date</span>
                  }
                </div>
                
                {/* Show currently selected range */}
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="text-xs text-center mt-2 bg-muted p-1 rounded">
                    <span className="font-medium">Current selection:</span>{" "}
                    {dateRange.startDate && format(dateRange.startDate, "PPP")}
                    {dateRange.endDate && dateRange.startDate !== dateRange.endDate && 
                      ` - ${format(dateRange.endDate, "PPP")}`}
                  </div>
                )}
              </div>
              
              {selectionMode === 'single' ? (
                // Single day selection calendar
                <Calendar
                  initialFocus
                  mode="single"
                  defaultMonth={dateRange.startDate}
                  selected={dateRange.startDate}
                  onSelect={(date) => {
                    if (date) {
                      // Only update the visual selection, not the applied range
                      setDateRange({
                        startDate: date,
                        endDate: date,
                      });
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                />
              ) : (
                // Range selection calendar
                <Calendar
                  initialFocus
                  mode="single"
                  defaultMonth={dateRange.startDate}
                  selected={selectionMode === 'start' ? dateRange.startDate : dateRange.endDate}
                  onSelect={(date) => {
                    if (!date) return;
                    
                    if (selectionMode === 'start') {
                      // When selecting start date
                      setDateRange(prev => ({
                        ...prev,
                        startDate: date,
                        // If new start date is after current end date, update end date too
                        endDate: date > prev.endDate ? date : prev.endDate,
                      }));
                      setSelectionMode('end');
                    } else {
                      // When selecting end date
                      // If selected date is before start date, swap them
                      if (date < dateRange.startDate) {
                        setDateRange({
                          startDate: date,
                          endDate: dateRange.startDate,
                        });
                      } else {
                        setDateRange(prev => ({
                          ...prev,
                          endDate: date,
                        }));
                      }
                      // Go back to start mode for next selection
                      setSelectionMode('start');
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                  // Highlight range
                  modifiers={{
                    selected: (date) => date.getTime() === dateRange.startDate.getTime() || 
                                        date.getTime() === dateRange.endDate.getTime(),
                    range_start: (date) => date.getTime() === dateRange.startDate.getTime(),
                    range_end: (date) => date.getTime() === dateRange.endDate.getTime(),
                    range_middle: (date) => 
                      date > dateRange.startDate && date < dateRange.endDate,
                  }}
                  modifiersClassNames={{
                    selected: 'bg-primary text-primary-foreground',
                    range_start: 'rounded-l-md',
                    range_end: 'rounded-r-md',
                    range_middle: 'bg-primary/20',
                  }}
                />
              )}
              
              <div className="p-3 border-t border-muted flex justify-between">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleLast7Days}
                >
                  Last 7 Days
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCalendarOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (selectionMode === 'single') {
                        handleSingleDaySelect(dateRange.startDate);
                      } else {
                        updateDateRange(dateRange.startDate, dateRange.endDate);
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="analytics">App Analytics</TabsTrigger>
            <TabsTrigger value="tokens">Token Usage</TabsTrigger>
            <TabsTrigger value="cost">Cost Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="space-y-8">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <p className="text-lg">Loading analytics data...</p>
              </div>
            ) : error ? (
              <div className="flex justify-center p-12">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <>
                {/* Daily Messages Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Usage Trend</CardTitle>
                    <CardDescription>
                      Number of messages sent each day for the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data?.dailyTrends}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [`${value} messages`, "Messages"]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Line 
                            type="monotone"
                            dataKey="messageCount"
                            name="Messages"
                            stroke="#8884d8"
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              
                {/* Project and User Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Most Active Projects */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Most Active Projects</CardTitle>
                      <CardDescription>
                        Projects with the highest message count
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data?.activeProjects}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={150}
                              tickFormatter={(value) => 
                                value.length > 20 ? `${value.substring(0, 20)}...` : value
                              }
                            />
                            <Tooltip formatter={(value) => [`${value} messages`, "Messages"]} />
                            <Legend />
                            <Bar 
                              dataKey="messageCount" 
                              name="Messages" 
                              fill="#8884d8" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Most Active Users */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Most Active Users</CardTitle>
                      <CardDescription>
                        Users who sent the most messages
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data?.activeUsers}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={150}
                              tickFormatter={(value) => 
                                value.length > 20 ? `${value.substring(0, 20)}...` : value
                              }
                            />
                            <Tooltip formatter={(value) => [`${value} messages`, "Messages"]} />
                            <Legend />
                            <Bar 
                              dataKey="messageCount" 
                              name="Messages" 
                              fill="#82ca9d" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="tokens" className="space-y-8">
            {isTokenUsageLoading ? (
              <div className="flex justify-center p-12">
                <p className="text-lg">Loading token usage data...</p>
              </div>
            ) : tokenUsageError ? (
              <div className="flex justify-center p-12">
                <p className="text-red-500">{tokenUsageError}</p>
              </div>
            ) : !tokenUsageData ? (
              <div className="flex justify-center p-12">
                <p className="text-amber-600">No token usage data available for the selected period.</p>
              </div>
            ) : tokenUsageData.tokenFieldsExist === false ? (
              <div className="flex justify-center p-12">
                <div className="max-w-2xl">
                  <p className="text-amber-600 text-lg mb-4">Token tracking is not yet enabled in the database.</p>
                  <p className="text-muted-foreground mb-2">
                    To enable token usage tracking, you need to add the necessary fields to your database schema.
                  </p>
                  <p className="text-muted-foreground">
                    Once tokens start being tracked in the database, they will appear in this dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Total Token Usage Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Total Token Usage</CardTitle>
                    <CardDescription>
                      Summary of token usage for all projects and users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-semibold">Prompt Tokens</div>
                        <div className="text-3xl font-bold text-primary">
                          {tokenUsageData.totalUsage.promptTokens.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Input tokens used for generating responses
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-semibold">Completion Tokens</div>
                        <div className="text-3xl font-bold text-primary">
                          {tokenUsageData.totalUsage.completionTokens.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Output tokens generated in responses
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-semibold">Total Tokens</div>
                        <div className="text-3xl font-bold text-primary">
                          {tokenUsageData.totalUsage.totalTokens.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Combined total of all tokens used
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Daily Token Usage Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Token Usage Trend</CardTitle>
                    <CardDescription>
                      Token usage distribution over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={getDailyTokenData(tokenUsageData)}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis 
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                          <Tooltip 
                            formatter={(value) => [Number(value).toLocaleString(), ""]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Area 
                            type="monotone"
                            dataKey="promptTokens"
                            name="Prompt Tokens"
                            stackId="1"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.6}
                          />
                          <Area 
                            type="monotone"
                            dataKey="completionTokens"
                            name="Completion Tokens"
                            stackId="1"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.6}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Project and User Token Usage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Projects Token Usage */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Projects by Token Usage</CardTitle>
                      <CardDescription>
                        Projects with the highest token consumption
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={getProjectTokenData(tokenUsageData)}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={150}
                              tickFormatter={(value) => 
                                value.length > 20 ? `${value.substring(0, 20)}...` : value
                              }
                            />
                            <Tooltip 
                              formatter={(value) => [Number(value).toLocaleString(), ""]} 
                            />
                            <Legend />
                            <Bar 
                              dataKey="promptTokens" 
                              name="Prompt Tokens" 
                              stackId="a"
                              fill="#8884d8" 
                            />
                            <Bar 
                              dataKey="completionTokens" 
                              name="Completion Tokens" 
                              stackId="a"
                              fill="#82ca9d" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Users Token Usage */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Users by Token Usage</CardTitle>
                      <CardDescription>
                        Users with the highest token consumption
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={getUserTokenData(tokenUsageData)}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={150}
                              tickFormatter={(value) => 
                                value.length > 20 ? `${value.substring(0, 20)}...` : value
                              }
                            />
                            <Tooltip 
                              formatter={(value) => [Number(value).toLocaleString(), ""]}
                            />
                            <Legend />
                            <Bar 
                              dataKey="promptTokens" 
                              name="Prompt Tokens" 
                              stackId="a"
                              fill="#8884d8" 
                            />
                            <Bar 
                              dataKey="completionTokens" 
                              name="Completion Tokens" 
                              stackId="a"
                              fill="#82ca9d" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="cost" className="space-y-8">
            {isOpenAIDataLoading ? (
              <div className="flex justify-center p-12">
                <p className="text-lg">Loading cost data...</p>
              </div>
            ) : openAIError ? (
              <div className="flex flex-col justify-center p-6 bg-muted/10 rounded-lg border">
                <p className="text-amber-600 mb-2">Note: {openAIError}</p>
                {openAIData ? (
                  <p className="text-muted-foreground">Displaying available data below. Some information may be estimates.</p>
                ) : null}
              </div>
            ) : openAIData?.isMockData ? (
              <div className="flex flex-col justify-center p-6 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-6">
                <p className="text-amber-600 font-medium mb-2">
                  Note: Displaying simulated OpenAI usage data
                  {openAIData.mockReason && (
                    <span className="ml-1">
                      ({openAIData.mockReason === "api_key_permission" 
                        ? "API key missing required permissions" 
                        : openAIData.mockReason === "api_error" 
                        ? "API request errors" 
                        : openAIData.mockReason === "api_exception" 
                        ? "API exception occurred" 
                        : openAIData.mockReason === "no_api_key"
                        ? "No API key configured"
                        : openAIData.mockReason === "rate_limit"
                        ? "API rate limit exceeded"
                        : openAIData.mockReason === "partial_data"
                        ? "Partial data available"
                        : "fallback data"})
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {openAIData.mockReason === "api_key_permission" ? (
                    "To see actual usage, ensure your OpenAI API key has the 'api.usage.read' scope. Service accounts need specific permission for usage data."
                  ) : openAIData.mockReason === "rate_limit" ? (
                    "The OpenAI API is currently rate limited. Please try again later."
                  ) : openAIData.mockReason === "no_api_key" ? (
                    "Please configure an OpenAI API key in the settings to see actual usage data."
                  ) : openAIData.mockReason === "partial_data" ? (
                    "Some OpenAI usage data was retrieved successfully, but other parts are simulated."
                  ) : (
                    "This data is generated for demonstration purposes. To see actual usage, ensure your OpenAI API key has the 'api.usage.read' scope."
                  )}
                </p>
              </div>
            ) : null}
            
            {/* Total Usage Summary */}
            {openAIData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">API Costs</CardTitle>
                    <CardDescription>Total OpenAI API usage costs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Completions Tokens (Input):</span>
                        <span className="font-semibold text-right">
                          {openAIData?.completions.total.tokens?.input.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Completions Tokens (Output):</span>
                        <span className="font-semibold text-right">
                          {openAIData?.completions.total.tokens?.output.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 border-t pt-2 mt-1">
                        <span className="text-muted-foreground">Total Cost:</span>
                        <span className="font-semibold text-right">
                          ${openAIData?.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Embeddings</CardTitle>
                    <CardDescription>Embeddings token usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Tokens:</span>
                        <span className="font-semibold text-right">
                          {openAIData?.embeddings.total.tokens?.input.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 border-t pt-2 mt-1">
                        <span className="text-muted-foreground">Note:</span>
                        <span className="text-right text-muted-foreground text-sm">
                          Cost included in total
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Vector Stores</CardTitle>
                    <CardDescription>Vector storage usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Storage:</span>
                        <span className="font-semibold text-right">
                          {formatBytes(openAIData?.vectorStores.total.bytes || 0)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 border-t pt-2 mt-1">
                        <span className="text-muted-foreground">Note:</span>
                        <span className="text-right text-muted-foreground text-sm">
                          Cost included in total
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Total Cost Card */}
            {openAIData && (
              <Card>
                <CardHeader>
                  <CardTitle>Total OpenAI Costs</CardTitle>
                  <CardDescription>
                    Total costs for the selected date range
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-center py-4">
                    ${openAIData?.totalCost.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Usage Trend Charts */}
            {openAIData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Completions Token Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Completions Token Usage</CardTitle>
                    <CardDescription>
                      Daily token usage for completions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getCompletionsTokenData(openAIData)}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [Number(value).toLocaleString(), ""]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Bar 
                            dataKey="input"
                            name="Input Tokens"
                            fill="#8884d8"
                          />
                          <Bar 
                            dataKey="output"
                            name="Output Tokens"
                            fill="#82ca9d" 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Daily Cost Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Cost Trend</CardTitle>
                    <CardDescription>
                      Daily OpenAI API costs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={getDailyCostData(openAIData)}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Line 
                            type="monotone"
                            dataKey="cost"
                            name="Daily Cost"
                            stroke="#8884d8"
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Embeddings Token Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Embeddings Token Usage</CardTitle>
                    <CardDescription>
                      Daily token usage for embeddings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getEmbeddingsTokenData(openAIData)}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [Number(value).toLocaleString(), "Tokens"]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Bar 
                            dataKey="tokens"
                            name="Embedding Tokens"
                            fill="#82ca9d"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Vector Stores Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Vector Storage Usage</CardTitle>
                    <CardDescription>
                      Daily vector storage usage in bytes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={getVectorStoresData(openAIData)}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return format(date, "MMM dd");
                            }}
                          />
                          <YAxis 
                            tickFormatter={(value) => formatBytes(value, 0)}
                          />
                          <Tooltip 
                            formatter={(value) => [formatBytes(Number(value)), "Storage"]}
                            labelFormatter={(label) => format(new Date(label), "PPP")}
                          />
                          <Legend />
                          <Area 
                            type="monotone"
                            dataKey="bytes"
                            name="Storage Used"
                            fill="#ffc658"
                            stroke="#ffc658"
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>Insights Dashboard</CardTitle>
              <CardDescription>Loading analytics data...</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px] flex items-center justify-center">
              <p className="text-muted-foreground text-lg">Loading insights dashboard...</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    }>
      <InsightsContent />
    </Suspense>
  );
}

// Helper function to format bytes into human-readable format
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format token counts into human-readable format
function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10000 ? 1 : 2)}K`;
  } else {
    return tokens.toString();
  }
}

// Helper function to prepare completions token data for charts
function getCompletionsTokenData(data: OpenAIUsageData | null) {
  if (!data) return [];
  
  return data.completions.daily.map(day => ({
    date: day.date,
    input: day.tokens?.input || 0,
    output: day.tokens?.output || 0
  }));
}

// New helper function to get embeddings token data
function getEmbeddingsTokenData(data: OpenAIUsageData | null) {
  if (!data) return [];
  
  return data.embeddings.daily.map(day => ({
    date: day.date,
    tokens: day.tokens?.input || 0
  }));
}

// Updated helper function to prepare cost data for the trends chart
function getDailyCostData(data: OpenAIUsageData | null) {
  if (!data) return [];
  
  // Just use the completions cost data which contains all costs
  return data.completions.daily.map(day => ({
    date: day.date,
    cost: day.cost
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Helper function to prepare vector stores usage data for charts
function getVectorStoresData(data: OpenAIUsageData | null) {
  if (!data) return [];
  
  return data.vectorStores.daily.map(day => ({
    date: day.date,
    bytes: day.bytes || 0
  }));
}

// Helper function to prepare token usage data by project for charts
function getProjectTokenData(data: TokenUsageStats | null) {
  if (!data) return [];
  
  return data.projectStats.map(project => ({
    name: project.name,
    promptTokens: project.promptTokens || 0,
    completionTokens: project.completionTokens || 0,
    totalTokens: project.totalTokens || 0,
  })).slice(0, 10); // Limit to top 10 projects
}

// Helper function to prepare token usage data by user for charts
function getUserTokenData(data: TokenUsageStats | null) {
  if (!data) return [];
  
  return data.userStats.map(user => ({
    name: user.name || user.email,
    promptTokens: user.promptTokens || 0,
    completionTokens: user.completionTokens || 0,
    totalTokens: user.totalTokens || 0,
  })).slice(0, 10); // Limit to top 10 users
}

// Helper function to prepare daily token usage data for charts
function getDailyTokenData(data: TokenUsageStats | null) {
  if (!data) return [];
  
  return data.dailyStats.map(day => ({
    date: day.date,
    promptTokens: day.promptTokens || 0,
    completionTokens: day.completionTokens || 0,
    totalTokens: day.totalTokens || 0,
  }));
} 