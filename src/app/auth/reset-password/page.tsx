"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { FieldValues } from "react-hook-form";

// Password validation schema
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formStatus, setFormStatus] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    message: string | null;
  }>({ type: null, message: null });

  // Initialize form
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!searchParams) return;
    
    // Extract token from URL
    const urlToken = searchParams.get('token');
    
    if (!urlToken) {
      setFormStatus({
        type: 'warning',
        message: 'Missing or invalid password reset token. Please request a new password reset link.'
      });
      return;
    }
    
    setToken(urlToken);
  }, [searchParams]);

  async function onSubmit(values: z.infer<typeof passwordSchema>) {
    if (!token) {
      setFormStatus({
        type: 'error',
        message: 'Missing reset token. Please request a new password reset link.'
      });
      return;
    }

    setIsLoading(true);
    setFormStatus({ type: null, message: null });

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      // Show success message
      setFormStatus({
        type: 'success',
        message: data.message || 'Your password has been reset successfully.'
      });
      
      // Reset form
      form.reset();
      
      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error: any) {
      console.error('Error resetting password:', error);
      setFormStatus({
        type: 'error',
        message: error.message || 'An error occurred while resetting your password.'
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-slate-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {formStatus.type === 'success' && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">
                {formStatus.message}
                <div className="mt-2 text-sm">
                  Redirecting to login page...
                </div>
              </AlertDescription>
            </Alert>
          )}

          {formStatus.type === 'error' && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {formStatus.message}
              </AlertDescription>
            </Alert>
          )}

          {formStatus.type === 'warning' && (
            <Alert className="mb-4 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Warning</AlertTitle>
              <AlertDescription className="text-amber-700">
                {formStatus.message}
                <div className="mt-2">
                  <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
                    Request a new password reset
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(!formStatus.type || formStatus.type === 'error') && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          disabled={isLoading || formStatus.type === 'success'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          disabled={isLoading || formStatus.type === 'success'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || formStatus.type === 'success' as any || formStatus.type === 'warning' as any}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : "Reset Password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center w-full">
            <Link 
              href="/auth/login" 
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen p-4 bg-slate-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Loading...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 