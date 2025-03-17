"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LucideLoader, LucideEye, LucideEyeOff, LucideShield, LucideSave, LucideKey, LucideBrain, LucideDatabase } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminSettingsPage() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDatabaseError, setIsDatabaseError] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminPermission = async () => {
      // First make sure the authentication is loaded
      if (hasRole === undefined) return;
      
      console.log("Checking admin permission...");
      
      // Check if user has admin role
      const isAdmin = hasRole("ADMIN");
      console.log("User has admin role:", isAdmin);
      
      if (!isAdmin) {
        console.log("Access denied - redirecting to home");
        toast.error("Access Denied", {
          description: "You don't have permission to access this page",
        });
        router.push("/");
      }
    };
    
    checkAdminPermission();
  }, [hasRole, router]);

  // Check database health first
  useEffect(() => {
    const checkDatabaseHealth = async () => {
      try {
        console.log("Checking database health...");
        const response = await fetch('/api/health');
        const data = await response.json();
        
        console.log("Database health:", data);
        
        if (data.status !== 'ok' || !data.database || data.database !== 'connected') {
          setError("Database connection error. Please check server logs.");
          setIsDatabaseError(true);
          return false;
        }
        
        if (!data.appSettingTableAvailable) {
          setError("AppSetting table is not accessible. Database migration may be required.");
          setIsDatabaseError(true);
          return false;
        }
        
        return true;
      } catch (err) {
        console.error("Health check error:", err);
        setError("Failed to check database health. Server may be down.");
        setIsDatabaseError(true);
        return false;
      }
    };
    
    checkDatabaseHealth().then(isHealthy => {
      if (isHealthy) {
        checkApiKey();
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  // Fetch current API key status
  const checkApiKey = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("Checking API key status...");
      
      const response = await fetch(`/api/admin/settings/openai-api`, {
        // Add specific headers to help with debugging
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log("API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        
        // Try to parse as JSON if possible
        let errorMessage = "Failed to check API key status";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If not JSON, use the raw text
          if (errorText) errorMessage += `: ${errorText}`;
        }
        
        // Check if it's a database error
        if (errorMessage.includes("Cannot read properties of undefined") || 
            errorMessage.includes("database") || 
            errorMessage.includes("prisma")) {
          setIsDatabaseError(true);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("API response data:", data);
      setIsApiKeySet(data.isSet);
    } catch (err) {
      console.error("Error checking API key:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to check API key status";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    try {
      setError(null);
      setIsSaving(true);

      // Simple validation
      if (!apiKey.trim()) {
        setError("API key is required");
        return;
      }

      // Basic format check for OpenAI API keys
      if (!apiKey.startsWith('sk-')) {
        setError("Invalid OpenAI API key format. Keys should start with 'sk-'");
        return;
      }

      const response = await fetch(`/api/admin/settings/openai-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save API key");
      }

      setIsApiKeySet(true);
      setApiKey("");
      toast.success("Success", {
        description: "OpenAI API key saved successfully",
      });
    } catch (err) {
      console.error("Error saving API key:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save API key";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/settings/openai-api`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to remove API key");
      }

      setIsApiKeySet(false);
      toast.success("Success", {
        description: "OpenAI API key removed successfully",
      });
    } catch (err) {
      console.error("Error removing API key:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to remove API key";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center">
            <div>
              <h1 className="text-display mb-2">App Settings</h1>
              <p className="text-muted-foreground text-lg">
                Manage application-level settings
              </p>
            </div>
          </div>

          {/* Database connection error */}
          {isDatabaseError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle className="flex items-center gap-2">
                <LucideDatabase className="h-5 w-5" />
                Database Connection Error
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <p>The database connection could not be established or the AppSetting table is not accessible. This might happen if:</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>The database server is not running</li>
                  <li>The database migration has not been applied</li>
                  <li>Environment variables are not configured correctly</li>
                </ul>
                <p className="text-sm mt-2">Error details: {error}</p>
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                  >
                    Retry Connection
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => window.open('/api/health', '_blank')}
                  >
                    Check API Health
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Other errors */}
          {error && !isDatabaseError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{error}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                  className="w-fit"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* API Key Management Card - only show if no database connection error */}
          {!isDatabaseError && (
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="flex-1">
                  <CardTitle>AI Provider Settings</CardTitle>
                  <CardDescription>
                    Configure settings for AI providers like OpenAI
                  </CardDescription>
                </div>
                <LucideKey className="h-6 w-6 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">OpenAI API Key</h3>
                    <p className="text-muted-foreground mb-4">
                      {isApiKeySet
                        ? "An OpenAI API key is currently configured. You can update or remove it below."
                        : "No OpenAI API key is configured. Add one to enable AI features."}
                    </p>

                    {isLoading ? (
                      <div className="flex justify-center py-4">
                        <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showApiKey ? "text" : "password"}
                              placeholder="Enter OpenAI API key"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                              aria-label={showApiKey ? "Hide API key" : "Show API key"}
                            >
                              {showApiKey ? (
                                <LucideEyeOff className="h-4 w-4" />
                              ) : (
                                <LucideEye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            onClick={handleSaveApiKey}
                            disabled={isSaving || !apiKey.trim()}
                          >
                            {isSaving ? (
                              <>
                                <LucideLoader className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <LucideSave className="mr-2 h-4 w-4" />
                                Save Key
                              </>
                            )}
                          </Button>
                        </div>

                        {isApiKeySet && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  disabled={isSaving}
                                >
                                  Remove API Key
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the OpenAI API key and disable AI features. Are you sure?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDeleteApiKey}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            <Button 
                              variant="outline" 
                              className="mt-4 w-full"
                              onClick={() => router.push("/admin/settings/ai-playground")}
                            >
                              <LucideBrain className="mr-2 h-4 w-4" />
                              Test with AI Playground
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 