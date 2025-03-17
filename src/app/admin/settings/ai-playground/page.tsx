"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LucideLoader, LucideBrain, LucideSend } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function AIPlaygroundPage() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!hasRole("ADMIN")) {
      toast.error("Access Denied", {
        description: "You don't have permission to access this page",
      });
      router.push("/");
    }
  }, [hasRole, router]);

  // Check if API key is set
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        setIsCheckingApiKey(true);
        const response = await fetch("/api/admin/settings/openai-api");
        const data = await response.json();
        setHasApiKey(data.isSet);
      } catch (error) {
        console.error("Error checking API key:", error);
        setError("Failed to check if API key is configured");
      } finally {
        setIsCheckingApiKey(false);
      }
    };

    checkApiKey();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate response");
      }

      setResponse(data.text || "No response generated");
    } catch (err) {
      console.error("Error generating AI response:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display mb-2">AI Playground</h1>
              <p className="text-muted-foreground text-lg">
                Test OpenAI API integration with your configured API key
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/admin/settings")}>
              Back to Settings
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center">
              <div className="flex-1">
                <CardTitle>AI Playground</CardTitle>
                <CardDescription>
                  Test the OpenAI API with your own prompts
                </CardDescription>
              </div>
              <LucideBrain className="h-6 w-6 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              {isCheckingApiKey ? (
                <div className="flex justify-center py-10">
                  <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !hasApiKey ? (
                <Alert className="mb-4">
                  <AlertTitle>No API Key Configured</AlertTitle>
                  <AlertDescription>
                    You need to set up an OpenAI API key in the settings before using this playground.
                    <div className="mt-4">
                      <Button onClick={() => router.push("/admin/settings")}>
                        Go to Settings
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <label className="font-medium" htmlFor="prompt">
                      Your Prompt
                    </label>
                    <Textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter your prompt here..."
                      className="min-h-[120px]"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading || !prompt.trim()} 
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <LucideLoader className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <LucideSend className="mr-2 h-4 w-4" />
                        Generate Response
                      </>
                    )}
                  </Button>

                  {response && (
                    <>
                      <Separator className="my-6" />
                      <div className="space-y-2">
                        <label className="font-medium">AI Response</label>
                        <div className="rounded-md border p-4 bg-muted/50 whitespace-pre-wrap">
                          {response}
                        </div>
                      </div>
                    </>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 