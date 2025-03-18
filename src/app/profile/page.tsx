"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LucideAlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U';

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
            <h1 className="text-display mb-2">My Profile</h1>
            <p className="text-muted-foreground text-lg">
              Manage your account settings and preferences
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 bg-primary">
                    <AvatarFallback className="text-xl font-medium text-primary-foreground">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold">{user?.name || 'No name set'}</h2>
                    <p className="text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-medium mb-2">Roles</h3>
                  <div className="flex flex-wrap gap-2">
                    {user?.roles?.map((role) => (
                      <span 
                        key={role} 
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <form onSubmit={handleSubmit}>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your account password</CardDescription>
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
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
} 