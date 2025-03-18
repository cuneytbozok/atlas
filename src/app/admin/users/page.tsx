"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LucideLoader, LucideSearch, LucideX, LucideUserPlus, LucideUsers, LucideShield, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Role {
  id: string;
  name: string;
  displayName?: string;
  description: string | null;
}

interface UserRole {
  id: string;
  role: Role;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  userRoles: UserRole[];
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [isRemovingRole, setIsRemovingRole] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<UserRole | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (!hasRole("ADMIN")) {
      toast.error("Access Denied", {
        description: "You don't have permission to access this page",
      });
      router.push("/");
    }
  }, [hasRole, router]);

  // Fetch users with roles
  const fetchUsers = async (page = 1, query = searchQuery) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/users/roles?page=${page}&limit=10&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error", {
        description: "Failed to fetch users",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available roles
  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/roles");

      if (!response.ok) {
        throw new Error("Failed to fetch roles");
      }

      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Error", {
        description: "Failed to fetch roles",
      });
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  // Handle search
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery !== null) {
        fetchUsers(1, searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      fetchUsers(newPage);
    }
  };

  // Handle role assignment
  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error("Error", {
        description: "Please select a user and a role",
      });
      return;
    }

    try {
      setIsAssigningRole(true);
      const response = await fetch("/api/users/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          roleId: selectedRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to assign role");
      }

      const data = await response.json();
      
      // Update the user in the list
      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (user.id === selectedUser.id) {
            return {
              ...user,
              userRoles: [...user.userRoles, { id: data.id, role: data.role }],
            };
          }
          return user;
        })
      );

      toast.success("Role assigned successfully");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to assign role",
      });
    } finally {
      setIsAssigningRole(false);
    }
  };

  // Handle role removal
  const handleRemoveRole = async () => {
    if (!roleToRemove) {
      return;
    }

    try {
      setIsRemovingRole(true);
      const response = await fetch(`/api/users/roles/${roleToRemove.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to remove role");
      }

      // Update the user in the list
      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (user.userRoles.some((ur) => ur.id === roleToRemove.id)) {
            return {
              ...user,
              userRoles: user.userRoles.filter((ur) => ur.id !== roleToRemove.id),
            };
          }
          return user;
        })
      );

      toast.success("Role removed successfully");
      setIsAlertDialogOpen(false);
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to remove role",
      });
    } finally {
      setIsRemovingRole(false);
    }
  };

  // Get user's initials for avatar
  const getUserInitials = (user: User): string => {
    if (user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Get user's display name
  const getUserDisplayName = (user: User): string => {
    return user.name || user.email;
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h1">User Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage user roles and permissions
              </p>
            </div>
          </div>

          <Separator />
          
          {/* Role Descriptions Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  <div className="flex items-center gap-2">
                    <LucideShield className="h-5 w-5 text-muted-foreground" />
                    <span>Role Descriptions</span>
                  </div>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Below are the roles that can be assigned to users. Each role has specific permissions and capabilities.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="border rounded-md p-3">
                  <h3 className="font-medium flex items-center gap-1.5">
                    <LucideShield className="h-4 w-4 text-destructive" />
                    Administrator
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Full access to all features including user management, app settings, and all project operations.
                  </p>
                </div>
                <div className="border rounded-md p-3">
                  <h3 className="font-medium flex items-center gap-1.5">
                    <LucideShield className="h-4 w-4 text-amber-500" />
                    Project Manager
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Can create and manage projects, assign team members, and manage project files and resources.
                  </p>
                </div>
                <div className="border rounded-md p-3">
                  <h3 className="font-medium flex items-center gap-1.5">
                    <LucideShield className="h-4 w-4 text-primary" />
                    Team Member
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Basic access to participate in assigned projects, use chat, and view project resources.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search users by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <LucideX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  <div className="flex items-center gap-2">
                    <LucideUsers className="h-5 w-5 text-muted-foreground" />
                    <span>Users</span>
                  </div>
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {pagination.total} users
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "No users match your search criteria"
                      : "No users found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="py-3 px-4 text-left font-medium">User</th>
                          <th className="py-3 px-4 text-left font-medium">Roles</th>
                          <th className="py-3 px-4 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {getUserInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {getUserDisplayName(user)}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {user.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-2">
                                {user.userRoles.map((userRole) => (
                                  <div key={userRole.id} className="flex items-center gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="flex items-center gap-1">
                                            <LucideShield className="h-3 w-3" />
                                            {userRole.role.displayName || userRole.role.name}
                                            <button
                                              onClick={() => {
                                                setRoleToRemove(userRole);
                                                setIsAlertDialogOpen(true);
                                              }}
                                              className="ml-1 rounded-full hover:bg-muted p-0.5"
                                            >
                                              <LucideX className="h-3 w-3" />
                                            </button>
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{userRole.role.description || 'No description available'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                ))}
                                {user.userRoles.length === 0 && (
                                  <span className="text-sm text-muted-foreground">
                                    No roles assigned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Dialog
                                open={isDialogOpen && selectedUser?.id === user.id}
                                onOpenChange={(open) => {
                                  setIsDialogOpen(open);
                                  if (open) {
                                    setSelectedUser(user);
                                    setSelectedRole("");
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <LucideUserPlus className="h-4 w-4 mr-2" />
                                    Assign Role
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                  <DialogHeader>
                                    <DialogTitle>Assign Role</DialogTitle>
                                    <DialogDescription>
                                      Assign a role to {getUserDisplayName(user)}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                      <Label htmlFor="role">Role</Label>
                                      <Select
                                        value={selectedRole}
                                        onValueChange={setSelectedRole}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {roles
                                            .filter(
                                              (role) =>
                                                !user.userRoles.some(
                                                  (ur) => ur.role.id === role.id
                                                )
                                            )
                                            .map((role) => (
                                              <SelectItem
                                                key={role.id}
                                                value={role.id}
                                              >
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div className="flex items-center justify-between w-full">
                                                        <span>{role.displayName || role.name}</span>
                                                        <HelpCircle className="h-3 w-3 ml-2 text-muted-foreground" />
                                                      </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>{role.description || 'No description available'}</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setIsDialogOpen(false)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={handleAssignRole}
                                      disabled={isAssigningRole || !selectedRole}
                                    >
                                      {isAssigningRole ? "Assigning..." : "Assign Role"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alert Dialog for Role Removal */}
        <AlertDialog
          open={isAlertDialogOpen}
          onOpenChange={setIsAlertDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the{" "}
                <strong>{roleToRemove?.role.name}</strong> role? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveRole}
                disabled={isRemovingRole}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemovingRole ? "Removing..." : "Remove Role"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </ProtectedRoute>
  );
} 