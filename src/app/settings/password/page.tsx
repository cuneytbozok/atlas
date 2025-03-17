"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LucideAlertCircle, LucideCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate passwords
    if (!formData.currentPassword) {
      setError("Current password is required");
      toast.error("Validation Error", {
        description: "Current password is required"
      });
      setIsLoading(false);
      return;
    }

    if (!formData.newPassword) {
      setError("New password is required");
      toast.error("Validation Error", {
        description: "New password is required"
      });
      setIsLoading(false);
      return;
    }

    if (formData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      toast.error("Validation Error", {
        description: "New password must be at least 8 characters long"
      });
      setIsLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      toast.error("Validation Error", {
        description: "New password and confirmation do not match"
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      toast.success("Password Updated", {
        description: "Your password has been changed successfully"
      });
      
      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Redirect to settings page
      router.push("/settings");
    } catch (err) {
      console.error("Password change error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to change password. Please try again.";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-display mb-2">Change Password</h1>
            <p className="text-muted-foreground text-lg">
              Update your account password
            </p>
          </div>
          
          <Card className="max-w-md">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Password Settings</CardTitle>
                <CardDescription>
                  Change your account password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="mb-4 animate-in fade-in-50 duration-300 border-destructive/50">
                    <LucideAlertCircle className="h-5 w-5" />
                    <AlertTitle className="font-semibold">Error</AlertTitle>
                    <AlertDescription className="mt-1">{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    name="currentPassword" 
                    type="password"
                    value={formData.currentPassword} 
                    onChange={handleChange} 
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    name="newPassword" 
                    type="password"
                    value={formData.newPassword} 
                    onChange={handleChange} 
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    type="password"
                    value={formData.confirmPassword} 
                    onChange={handleChange} 
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 