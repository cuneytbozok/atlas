"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useEffect, Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LucideAlertCircle } from "lucide-react";
import { toast } from "sonner";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error or success messages in URL params
  useEffect(() => {
    const errorParam = searchParams?.get("error");
    const successParam = searchParams?.get("success");
    const registeredParam = searchParams?.get("registered");

    if (errorParam) {
      switch (errorParam) {
        case "CredentialsSignin":
          setError("Invalid email or password. Please try again.");
          toast.error("Login Failed", {
            description: "Invalid email or password. Please try again."
          });
          break;
        case "SessionRequired":
          setError("You need to be signed in to access that page.");
          toast.error("Authentication Required", {
            description: "You need to be signed in to access that page."
          });
          break;
        default:
          setError("An authentication error occurred. Please try again.");
          toast.error("Authentication Error", {
            description: "An authentication error occurred. Please try again."
          });
      }
    } else if (successParam) {
      // Handle success messages if needed
    } else if (registeredParam) {
      // Show a success message for newly registered users
      setError(""); // Clear any errors
      toast.success("Registration Successful", {
        description: "Your account has been created. Please sign in."
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      toast.error("Validation Error", {
        description: "Email is required"
      });
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError("Password is required");
      toast.error("Validation Error", {
        description: "Password is required"
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(email, password);

      if (!result.success) {
        // Map error codes to user-friendly messages
        if (result.error === "CredentialsSignin") {
          const errorMessage = "Invalid email or password. Please check your credentials and try again.";
          setError(errorMessage);
          toast.error("Login Failed", {
            description: errorMessage
          });
        } else {
          const errorMessage = result.error || "Failed to sign in. Please try again.";
          setError(errorMessage);
          toast.error("Authentication Error", {
            description: errorMessage
          });
        }
        return;
      }

      toast.success("Login Successful", {
        description: "You have been signed in successfully."
      });
      router.push("/");
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = "An unexpected error occurred. Please try again later.";
      setError(errorMessage);
      toast.error("System Error", {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in to ATLAS</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 animate-in fade-in-50 duration-300 border-destructive/50">
              <LucideAlertCircle className="h-5 w-5" />
              <AlertTitle className="font-semibold">Authentication Error</AlertTitle>
              <AlertDescription className="mt-1">{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className={error && !email ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={error && !password ? "border-destructive" : ""}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign in to ATLAS</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-center justify-center">
              <p className="text-muted-foreground">Loading login form...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
} 