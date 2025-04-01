"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LucideLoader, LucideEye, LucideEyeOff, LucideShield, LucideSave, LucideKey, LucideBrain, LucideDatabase, LucideMail } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [isModelSaving, setIsModelSaving] = useState(false);
  
  // Admin API key state
  const [adminApiKey, setAdminApiKey] = useState("");
  const [isAdminApiKeySet, setIsAdminApiKeySet] = useState(false);
  const [showAdminApiKey, setShowAdminApiKey] = useState(false);
  const [isAdminApiKeySaving, setIsAdminApiKeySaving] = useState(false);
  
  // Email settings state
  const [emailFrom, setEmailFrom] = useState<string>('');
  const [emailReplyTo, setEmailReplyTo] = useState<string>('');
  const [resendApiKey, setResendApiKey] = useState<string>('');
  const [showResendApiKey, setShowResendApiKey] = useState<boolean>(false);
  const [isEmailSaving, setIsEmailSaving] = useState<boolean>(false);
  const [isResendApiKeySet, setIsResendApiKeySet] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState("openai");
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [isTestEmailSending, setIsTestEmailSending] = useState<boolean>(false);

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
        checkAppSettings();
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  // New function to check app settings and permissions
  const checkAppSettings = async () => {
    try {
      console.log("Checking app settings and permissions...");
      const response = await fetch('/api/admin/settings/check');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Settings check error:", errorText);
        throw new Error("Failed to check app settings");
      }
      
      const data = await response.json();
      console.log("App settings check:", data);
      
      if (!data.isAppSettingAccessible) {
        setError("AppSetting table is not accessible. Database migration may be required.");
        setIsDatabaseError(true);
        return;
      }
      
      if (!data.permissions.hasAdminRole) {
        setError("You don't have the ADMIN role required to access this page.");
        return;
      }
      
      if (!data.permissions.hasAppSettingsPermission) {
        setError("You don't have the MANAGE_APP_SETTINGS or VIEW_APP_SETTINGS permission required.");
        return;
      }
      
      // If we got this far, proceed to fetch the API key status
      checkApiKey();
    } catch (err) {
      console.error("Error checking app settings:", err);
      setError(err instanceof Error ? err.message : "Failed to check app settings");
      setIsLoading(false);
    }
  };

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
      
      // Also check admin API key status
      const adminResponse = await fetch(`/api/admin/settings/openai-admin-api`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        console.log("Admin API response data:", adminData);
        setIsAdminApiKeySet(adminData.isSet);
      }
      
      // Get the current model setting
      const modelResponse = await fetch(`/api/admin/settings/openai-model`);
      if (modelResponse.ok) {
        const modelData = await modelResponse.json();
        if (modelData.model) {
          setAiModel(modelData.model);
        }
      }
      
      // Load email settings
      loadEmailSettings();
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

  const handleSaveModel = async () => {
    try {
      setError(null);
      setIsModelSaving(true);

      // Simple validation
      if (!aiModel.trim()) {
        setError("Model name is required");
        return;
      }

      const response = await fetch(`/api/admin/settings/openai-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: aiModel }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save model setting");
      }

      toast.success("Success", {
        description: "OpenAI model saved successfully",
      });
    } catch (err) {
      console.error("Error saving model:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save model";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsModelSaving(false);
    }
  };

  // Add handler for saving the admin API key
  const handleSaveAdminApiKey = async () => {
    try {
      setError(null);
      setIsAdminApiKeySaving(true);

      // Simple validation
      if (!adminApiKey.trim()) {
        setError("Admin API key is required");
        return;
      }

      // Basic format check for OpenAI API keys
      if (!adminApiKey.startsWith('sk-')) {
        setError("Invalid OpenAI API key format. Keys should start with 'sk-'");
        return;
      }

      const response = await fetch(`/api/admin/settings/openai-admin-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: adminApiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save admin API key");
      }

      setIsAdminApiKeySet(true);
      setAdminApiKey("");
      toast.success("Success", {
        description: "OpenAI Admin API key saved successfully",
      });
    } catch (err) {
      console.error("Error saving admin API key:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save admin API key";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsAdminApiKeySaving(false);
    }
  };

  // Add handler for deleting the admin API key
  const handleDeleteAdminApiKey = async () => {
    try {
      setError(null);
      setIsAdminApiKeySaving(true);

      const response = await fetch(`/api/admin/settings/openai-admin-api`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete admin API key");
      }

      setIsAdminApiKeySet(false);
      toast.success("Success", {
        description: "OpenAI Admin API key removed successfully",
      });
    } catch (err) {
      console.error("Error deleting admin API key:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete admin API key";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsAdminApiKeySaving(false);
    }
  };
  
  // Load email settings
  const loadEmailSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/email');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load email settings');
      }
      
      const data = await response.json();
      
      if (data.emailFrom) {
        setEmailFrom(data.emailFrom);
      }
      
      if (data.emailReplyTo) {
        setEmailReplyTo(data.emailReplyTo);
      }
      
      setIsResendApiKeySet(data.isResendApiKeySet || false);
      
    } catch (err) {
      console.error('Error loading email settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load email settings';
      toast.error('Error', {
        description: errorMessage
      });
    }
  };
  
  // Save email settings
  const handleSaveEmailSettings = async () => {
    try {
      setError(null);
      setIsEmailSaving(true);
      
      // Validate email addresses
      if (emailFrom && !isValidEmail(emailFrom)) {
        setError('Invalid sender email address');
        return;
      }
      
      if (emailReplyTo && !isValidEmail(emailReplyTo)) {
        setError('Invalid reply-to email address');
        return;
      }
      
      const response = await fetch('/api/admin/settings/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailFrom,
          emailReplyTo
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save email settings');
      }
      
      toast.success('Success', {
        description: 'Email settings saved successfully'
      });
      
    } catch (err) {
      console.error('Error saving email settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save email settings';
      setError(errorMessage);
      toast.error('Error', {
        description: errorMessage
      });
    } finally {
      setIsEmailSaving(false);
    }
  };
  
  // Save Resend API key
  const handleSaveResendApiKey = async () => {
    try {
      setError(null);
      setIsEmailSaving(true);
      
      if (!resendApiKey.trim()) {
        setError('Resend API key is required');
        return;
      }
      
      if (!resendApiKey.startsWith('re_')) {
        setError('Invalid Resend API key format. Keys should start with "re_"');
        return;
      }
      
      const response = await fetch('/api/admin/settings/email/resend-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: resendApiKey
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save Resend API key');
      }
      
      setIsResendApiKeySet(true);
      setResendApiKey('');
      toast.success('Success', {
        description: 'Resend API key saved successfully'
      });
      
    } catch (err) {
      console.error('Error saving Resend API key:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save Resend API key';
      setError(errorMessage);
      toast.error('Error', {
        description: errorMessage
      });
    } finally {
      setIsEmailSaving(false);
    }
  };
  
  // Delete Resend API key
  const handleDeleteResendApiKey = async () => {
    try {
      setError(null);
      setIsEmailSaving(true);
      
      const response = await fetch('/api/admin/settings/email/resend-api', {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete Resend API key');
      }
      
      setIsResendApiKeySet(false);
      toast.success('Success', {
        description: 'Resend API key removed successfully'
      });
      
    } catch (err) {
      console.error('Error deleting Resend API key:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete Resend API key';
      setError(errorMessage);
      toast.error('Error', {
        description: errorMessage
      });
    } finally {
      setIsEmailSaving(false);
    }
  };
  
  // Helper function to validate email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Send test email
  const handleSendTestEmail = async () => {
    try {
      setError(null);
      setIsTestEmailSending(true);
      
      // Validate email address
      if (!testEmailAddress || !isValidEmail(testEmailAddress)) {
        setError('Please enter a valid email address for testing');
        setIsTestEmailSending(false);
        return;
      }
      
      const response = await fetch('/api/admin/settings/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testEmail: testEmailAddress
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send test email');
      }
      
      const data = await response.json();
      
      toast.success('Success', {
        description: `Test email sent successfully to ${data.recipient}`
      });
      
    } catch (err) {
      console.error('Error sending test email:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test email';
      setError(errorMessage);
      toast.error('Error', {
        description: errorMessage
      });
    } finally {
      setIsTestEmailSending(false);
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

          {/* Settings Tabs - only show if no database connection error */}
          {!isDatabaseError && (
            <Tabs defaultValue="openai" className="w-full" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="openai" className="flex items-center gap-2">
                  <LucideBrain className="h-4 w-4" />
                  OpenAI Settings
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <LucideMail className="h-4 w-4" />
                  Email Settings
                </TabsTrigger>
              </TabsList>
              
              {/* OpenAI Settings Tab */}
              <TabsContent value="openai">
                <Card>
                  <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>OpenAI Configuration</CardTitle>
                        <CardDescription>
                          Configure OpenAI API settings for AI features
                        </CardDescription>
                      </div>
                      <LucideKey className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* API Key Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">API Key</h3>
                      
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : isApiKeySet ? (
                        <div className="space-y-4">
                          <Alert variant="default" className="bg-green-50 dark:bg-green-950">
                            <AlertTitle>API Key Configured</AlertTitle>
                            <AlertDescription>
                              Your OpenAI API key is configured and ready to use.
                            </AlertDescription>
                          </Alert>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                Remove API Key
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove your OpenAI API key? This will disable AI features until a new key is provided.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteApiKey}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex">
                              <Input
                                type={showApiKey ? "text" : "password"}
                                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="flex-1 rounded-r-none focus-visible:ring-0 focus-visible:ring-transparent"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="rounded-l-none border-l-0"
                                type="button"
                              >
                                {showApiKey ? <LucideEyeOff /> : <LucideEye />}
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enter your OpenAI API key to enable AI features.
                              Your key is securely encrypted before storage.
                            </p>
                          </div>
                          <Button
                            onClick={handleSaveApiKey}
                            disabled={isSaving || !apiKey.trim()}
                          >
                            {isSaving ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideSave className="mr-2 h-4 w-4" />}
                            Save API Key
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Admin API Key Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Admin API Key</h3>
                      <p className="text-sm text-muted-foreground">
                        Separate API key for usage analytics with the 'api.usage.read' permission scope.
                        Use a dedicated API key with admin permissions for analytics.
                      </p>
                      
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : isAdminApiKeySet ? (
                        <div className="space-y-4">
                          <Alert variant="default" className="bg-green-50 dark:bg-green-950">
                            <AlertTitle>Admin API Key Configured</AlertTitle>
                            <AlertDescription>
                              Your OpenAI Admin API key is configured for usage analytics.
                            </AlertDescription>
                          </Alert>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                Remove Admin API Key
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Admin API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove your OpenAI Admin API key? This will disable real usage analytics until a new key is provided.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAdminApiKey}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex">
                              <Input
                                type={showAdminApiKey ? "text" : "password"}
                                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                value={adminApiKey}
                                onChange={(e) => setAdminApiKey(e.target.value)}
                                className="flex-1 rounded-r-none focus-visible:ring-0 focus-visible:ring-transparent"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowAdminApiKey(!showAdminApiKey)}
                                className="rounded-l-none border-l-0"
                                type="button"
                              >
                                {showAdminApiKey ? <LucideEyeOff /> : <LucideEye />}
                              </Button>
                            </div>
                          </div>
                          <Button
                            onClick={handleSaveAdminApiKey}
                            disabled={isAdminApiKeySaving || !adminApiKey.trim()}
                          >
                            {isAdminApiKeySaving ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideSave className="mr-2 h-4 w-4" />}
                            Save Admin API Key
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Model Selection Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">AI Model Configuration</h3>
                      
                      <div className="space-y-2">
                        <label htmlFor="ai-model" className="text-sm font-medium">
                          OpenAI Model
                        </label>
                        <Input
                          id="ai-model"
                          placeholder="e.g., gpt-4o, gpt-3.5-turbo"
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Specify which OpenAI model to use for AI features. Default is gpt-4o.
                        </p>
                      </div>
                      
                      <Button
                        onClick={handleSaveModel}
                        disabled={isModelSaving || !aiModel.trim()}
                      >
                        {isModelSaving ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideSave className="mr-2 h-4 w-4" />}
                        Save Model Setting
                      </Button>
                    </div>

                    {/* AI Playground Link */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">AI Playground</h3>
                      <Button 
                        variant="outline" 
                        onClick={() => router.push('/admin/settings/ai-playground')}
                        disabled={!isApiKeySet}
                      >
                        <LucideBrain className="mr-2 h-4 w-4" />
                        Open AI Playground
                      </Button>
                      {!isApiKeySet && (
                        <p className="text-sm text-muted-foreground">
                          You need to set up an API key before using the AI Playground.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Email Settings Tab */}
              <TabsContent value="email">
                <Card>
                  <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Email Configuration</CardTitle>
                        <CardDescription>
                          Configure email settings for notifications and user communications
                        </CardDescription>
                      </div>
                      <LucideMail className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Resend API Key Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Resend API Key</h3>
                      <p className="text-sm text-muted-foreground">
                        Resend.com API key for sending transactional emails like password resets and notifications.
                      </p>
                      
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : isResendApiKeySet ? (
                        <div className="space-y-4">
                          <Alert variant="default" className="bg-green-50 dark:bg-green-950">
                            <AlertTitle>Resend API Key Configured</AlertTitle>
                            <AlertDescription>
                              Your Resend API key is configured for sending emails.
                            </AlertDescription>
                          </Alert>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                Remove Resend API Key
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Resend API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove your Resend API key? This will disable email sending capabilities until a new key is provided.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteResendApiKey}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex">
                              <Input
                                type={showResendApiKey ? "text" : "password"}
                                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                value={resendApiKey}
                                onChange={(e) => setResendApiKey(e.target.value)}
                                className="flex-1 rounded-r-none focus-visible:ring-0 focus-visible:ring-transparent"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowResendApiKey(!showResendApiKey)}
                                className="rounded-l-none border-l-0"
                                type="button"
                              >
                                {showResendApiKey ? <LucideEyeOff /> : <LucideEye />}
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enter your Resend API key to enable email functionality.
                              Get one at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com</a>.
                            </p>
                          </div>
                          <Button
                            onClick={handleSaveResendApiKey}
                            disabled={isEmailSaving || !resendApiKey.trim()}
                          >
                            {isEmailSaving ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideSave className="mr-2 h-4 w-4" />}
                            Save Resend API Key
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Email Address Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Email Address Configuration</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="email-from" className="text-sm font-medium">
                            From Address
                          </label>
                          <Input
                            id="email-from"
                            placeholder="noreply@yourdomain.com"
                            value={emailFrom}
                            onChange={(e) => setEmailFrom(e.target.value)}
                          />
                          <p className="text-sm text-muted-foreground">
                            The email address that will appear in the "From" field of sent emails.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email-reply-to" className="text-sm font-medium">
                            Reply-To Address
                          </label>
                          <Input
                            id="email-reply-to"
                            placeholder="support@yourdomain.com"
                            value={emailReplyTo}
                            onChange={(e) => setEmailReplyTo(e.target.value)}
                          />
                          <p className="text-sm text-muted-foreground">
                            The email address that recipients will reply to when responding to emails.
                          </p>
                        </div>
                        
                        <Button
                          onClick={handleSaveEmailSettings}
                          disabled={isEmailSaving}
                        >
                          {isEmailSaving ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideSave className="mr-2 h-4 w-4" />}
                          Save Email Settings
                        </Button>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Email Testing */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Test Email Configuration</h3>
                      <p className="text-sm text-muted-foreground">
                        Send a test email to verify your configuration is working correctly.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="test-email" className="text-sm font-medium">
                            Test Email Address
                          </label>
                          <Input
                            id="test-email"
                            placeholder="your-email@example.com"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            disabled={!isResendApiKeySet || isTestEmailSending}
                          />
                          <p className="text-sm text-muted-foreground">
                            Enter the email address where you want to receive the test email.
                          </p>
                        </div>
                        
                        <Button 
                          variant="outline"
                          disabled={!isResendApiKeySet || isTestEmailSending || !testEmailAddress}
                          onClick={handleSendTestEmail}
                        >
                          {isTestEmailSending ? (
                            <>
                              <LucideLoader className="mr-2 h-4 w-4 animate-spin" />
                              Sending Test Email...
                            </>
                          ) : (
                            <>
                              <LucideMail className="mr-2 h-4 w-4" />
                              Send Test Email
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {!isResendApiKeySet && (
                        <p className="text-sm text-muted-foreground">
                          You need to set up a Resend API key before testing email functionality.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 