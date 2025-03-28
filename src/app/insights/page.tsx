"use client";

import { useState, useEffect } from "react";
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

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [openAIData, setOpenAIData] = useState<OpenAIUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpenAIDataLoading, setIsOpenAIDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAIError, setOpenAIError] = useState<string | null>(null);
  
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
  
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: startParam ? new Date(startParam) : subDays(new Date(), 7),
    endDate: endParam ? new Date(endParam) : new Date(),
  });
  
  // Date picker state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch analytics data
  useEffect(() => {
    // Skip fetching if not admin
    if (!isAdmin) return;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Format dates for API request
        const startDateStr = format(dateRange.startDate, "yyyy-MM-dd");
        const endDateStr = format(dateRange.endDate, "yyyy-MM-dd");
        
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
  }, [dateRange.startDate, dateRange.endDate, isAdmin]);
  
  // Fetch OpenAI usage data
  useEffect(() => {
    // Skip fetching if not admin
    if (!isAdmin) return;
    
    const fetchOpenAIData = async () => {
      try {
        setIsOpenAIDataLoading(true);
        
        // Format dates for API request
        const startDateStr = format(dateRange.startDate, "yyyy-MM-dd");
        const endDateStr = format(dateRange.endDate, "yyyy-MM-dd");
        
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
  }, [dateRange.startDate, dateRange.endDate, isAdmin]);
  
  // Don't render page content for non-admin users
  if (authLoading) {
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex justify-center p-12">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
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
    );
  }
  
  // Update URL when date range changes
  const updateDateRange = (startDate: Date, endDate: Date) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("startDate", format(startDate, "yyyy-MM-dd"));
    params.set("endDate", format(endDate, "yyyy-MM-dd"));
    
    router.push(`/insights?${params.toString()}`);
    
    setDateRange({ startDate, endDate });
    // Only close the calendar when we have a complete range
    if (startDate && endDate) {
      setIsCalendarOpen(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Insights</h1>
        
        {/* Date Range Selector */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.startDate, "PPP")} - {format(dateRange.endDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            {/* Add clear instructions about the date picker */}
            <div className="p-3 border-b border-muted">
              <div className="text-sm font-medium text-center">
                Select date range
              </div>
              <div className="text-xs text-muted-foreground text-center mt-1">
                {dateRange.startDate && !dateRange.endDate ? 
                  `${format(dateRange.startDate, "PPP")} - Click a second date to complete selection` 
                  : "Click two dates to select a range"}
              </div>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.startDate}
              selected={{
                from: dateRange.startDate,
                to: dateRange.endDate,
              }}
              onSelect={(range) => {
                if (range?.from) {
                  const newEndDate = range.to || range.from;
                  
                  // Always update the internal state to show progress
                  setDateRange({
                    startDate: range.from,
                    endDate: newEndDate,
                  });
                  
                  // Only update URL and close calendar when a complete range is selected
                  if (range.to) {
                    updateDateRange(range.from, newEndDate);
                  }
                }
              }}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
            />
            <div className="p-3 border-t border-muted flex justify-end">
              <Button 
                size="sm" 
                onClick={() => {
                  if (dateRange.startDate && dateRange.endDate) {
                    updateDateRange(dateRange.startDate, dateRange.endDate);
                  }
                }}
                disabled={!dateRange.startDate || !dateRange.endDate}
              >
                Apply Range
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="analytics">App Analytics</TabsTrigger>
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