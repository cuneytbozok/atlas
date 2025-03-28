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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
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
interface UsageCost {
  total: number;
  daily: {
    date: string;
    cost: number;
  }[];
}

interface OpenAIUsageData {
  completions: UsageCost;
  embeddings: UsageCost;
  vectorStores: UsageCost;
  totalCost: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
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
        setOpenAIData(openAIUsageData);
        setOpenAIError(null);
      } catch (err: any) {
        console.error("Failed to fetch OpenAI usage data:", err);
        setOpenAIError(err.message || "Failed to load OpenAI usage data. Please try again later.");
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
    setIsCalendarOpen(false);
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
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.startDate}
              selected={{
                from: dateRange.startDate,
                to: dateRange.endDate,
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  updateDateRange(range.from, range.to);
                }
              }}
              numberOfMonths={2}
            />
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
              <p className="text-lg">Loading OpenAI usage data...</p>
            </div>
          ) : openAIError ? (
            <div className="flex justify-center p-12">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Error Loading Cost Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-500">{openAIError}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Total Usage Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Completions</CardTitle>
                    <CardDescription>Chat & completion API usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      ${openAIData?.completions.total.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Embeddings</CardTitle>
                    <CardDescription>Embedding API usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      ${openAIData?.embeddings.total.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">Vector Stores</CardTitle>
                    <CardDescription>Vector storage usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      ${openAIData?.vectorStores.total.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Total Cost Card */}
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
              
              {/* Daily Cost Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Cost Trends</CardTitle>
                  <CardDescription>
                    Daily OpenAI API costs for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={combineOpenAIDailyData(openAIData)}
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
                          formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
                          labelFormatter={(label) => format(new Date(label), "PPP")}
                        />
                        <Legend />
                        <Line 
                          type="monotone"
                          dataKey="completions"
                          name="Completions"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                        <Line 
                          type="monotone"
                          dataKey="embeddings"
                          name="Embeddings"
                          stroke="#82ca9d" 
                        />
                        <Line 
                          type="monotone"
                          dataKey="vectorStores"
                          name="Vector Stores"
                          stroke="#ffc658"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to combine daily data from different sources
function combineOpenAIDailyData(data: OpenAIUsageData | null) {
  if (!data) return [];
  
  // Create a map to combine data by date
  const combinedData: Record<string, {
    date: string;
    completions: number;
    embeddings: number;
    vectorStores: number;
  }> = {};
  
  // Process completions data
  data.completions.daily.forEach(item => {
    if (!combinedData[item.date]) {
      combinedData[item.date] = {
        date: item.date,
        completions: 0,
        embeddings: 0,
        vectorStores: 0
      };
    }
    combinedData[item.date].completions = item.cost;
  });
  
  // Process embeddings data
  data.embeddings.daily.forEach(item => {
    if (!combinedData[item.date]) {
      combinedData[item.date] = {
        date: item.date,
        completions: 0,
        embeddings: 0,
        vectorStores: 0
      };
    }
    combinedData[item.date].embeddings = item.cost;
  });
  
  // Process vector stores data
  data.vectorStores.daily.forEach(item => {
    if (!combinedData[item.date]) {
      combinedData[item.date] = {
        date: item.date,
        completions: 0,
        embeddings: 0,
        vectorStores: 0
      };
    }
    combinedData[item.date].vectorStores = item.cost;
  });
  
  // Convert to array and sort by date
  return Object.values(combinedData).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
} 