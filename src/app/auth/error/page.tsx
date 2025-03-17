"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An unknown error occurred during authentication.";
  let errorDescription = "Please try again or contact support if the problem persists.";

  // Map error codes to user-friendly messages
  if (error === "CredentialsSignin") {
    errorMessage = "Invalid login credentials";
    errorDescription = "The email or password you entered is incorrect.";
  } else if (error === "AccessDenied") {
    errorMessage = "Access denied";
    errorDescription = "You do not have permission to access this resource.";
  } else if (error === "OAuthSignin" || error === "OAuthCallback" || error === "OAuthCreateAccount") {
    errorMessage = "OAuth authentication error";
    errorDescription = "There was a problem with the OAuth authentication process.";
  } else if (error === "EmailCreateAccount") {
    errorMessage = "Could not create account";
    errorDescription = "There was a problem creating your account.";
  } else if (error === "Callback") {
    errorMessage = "Authentication callback error";
    errorDescription = "There was a problem during the authentication process.";
  } else if (error === "SessionRequired") {
    errorMessage = "Authentication required";
    errorDescription = "You must be signed in to access this page.";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-destructive">Authentication Error</CardTitle>
          <CardDescription className="text-lg font-medium">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{errorDescription}</p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link href="/auth/login">Back to Login</Link>
          </Button>
          <Button asChild>
            <Link href="/">Go to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 