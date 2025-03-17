"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams, useRouter } from "next/navigation";
import { LucideCalendar, LucideUsers, LucideFileText, LucideLoader, LucideSearch, LucideUserPlus, LucideX } from "lucide-react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface ProjectMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  members: ProjectMember[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

// Helper functions for member data
const safeCharAt = (str: string | null | undefined, index: number): string => {
  return str ? str.charAt(index) : "?";
};

const getInitials = (member: ProjectMember): string => {
  if (!member?.user) return "?";
  return member.user.name 
    ? safeCharAt(member.user.name, 0).toUpperCase()
    : safeCharAt(member.user.email, 0).toUpperCase();
};

const getDisplayName = (member: ProjectMember): string => {
  if (!member?.user) return "Unknown User";
  return member.user.name || member.user.email;
};

const getEmail = (member: ProjectMember): string => {
  if (!member?.user) return "No email";
  return member.user.email;
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageTeamDialogOpen, setIsManageTeamDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
            return;
          }
          throw new Error("Failed to fetch project");
        }
        
        const data = await response.json();
        console.log("Project data:", data); // Debug log
        
        // Add status if it doesn't exist
        if (!data.status) {
          data.status = "active";
        }
        
        setProject(data);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("An error occurred while fetching the project. Please try again.");
        toast.error("Error", {
          description: "Failed to fetch project details"
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleDeleteProject = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/projects/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete project");
      }

      toast.success("Project deleted successfully");
      router.push("/projects");
    } catch (err) {
      console.error("Error deleting project:", err);
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete project"
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    // Ensure we have all the required fields
    if (!updatedProject.members) {
      updatedProject.members = project?.members || [];
    }
    
    if (!updatedProject.status) {
      updatedProject.status = "active";
    }
    
    setProject(updatedProject);
    setIsEditDialogOpen(false);
    toast.success("Project updated successfully");
  };

  const handleMemberAdded = (newMember: ProjectMember) => {
    if (project) {
      setProject({
        ...project,
        members: [...project.members, newMember]
      });
      toast.success("Team member added successfully");
    }
  };

  const handleMemberRemoved = (memberId: string) => {
    if (project) {
      setProject({
        ...project,
        members: project.members.filter(member => member.id !== memberId)
      });
      toast.success("Team member removed successfully");
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex h-full items-center justify-center">
            <LucideLoader className="h-8 w-8 animate-spin text-primary" />
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (error || !project) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h1 className="text-h1 mb-2">Project Not Found</h1>
              <p className="text-muted-foreground mb-4">
                The project you are looking for does not exist or has been removed.
              </p>
              <Button asChild>
                <Link href="/projects">Back to Projects</Link>
              </Button>
            </div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  const formattedCreatedDate = new Date(project.createdAt).toLocaleDateString();
  const formattedUpdatedDate = new Date(project.updatedAt).toLocaleDateString();

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-h1">{project.name}</h1>
                {project.status && (
                  <div className={`rounded-full px-3 py-1 text-sm ${
                    project.status === "active" 
                      ? "bg-success/20 text-success" 
                      : project.status === "completed" 
                        ? "bg-info/20 text-info" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {safeCharAt(project.status, 0) + (project.status.slice(1) || '')}
                  </div>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {project.description || "No description provided"}
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit Project</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <EditProjectForm 
                    project={project} 
                    onSuccess={handleProjectUpdated} 
                    onCancel={() => setIsEditDialogOpen(false)} 
                  />
                </DialogContent>
              </Dialog>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the project
                      and all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteProject}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Separator />

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <LucideCalendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formattedCreatedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formattedUpdatedDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <LucideUsers className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {project.members && Array.isArray(project.members) && project.members.length > 0 ? (
                    project.members.map((member, index) => (
                      <div key={member.id || index} className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm">{getDisplayName(member)}</span>
                          <span className="text-xs text-muted-foreground">{getEmail(member)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No team members yet</p>
                  )}
                  
                  <Dialog open={isManageTeamDialogOpen} onOpenChange={setIsManageTeamDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        <LucideUsers className="h-4 w-4 mr-2" />
                        Manage Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <ManageTeamForm 
                        project={project} 
                        onMemberAdded={handleMemberAdded}
                        onMemberRemoved={handleMemberRemoved}
                        onClose={() => setIsManageTeamDialogOpen(false)} 
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <LucideFileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">Project Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created By</span>
                    <span>{project.createdBy?.name || project.createdBy?.email || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team Size</span>
                    <span>{(project.members && Array.isArray(project.members) ? project.members.length : 0)} members</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <h2 className="text-h2 mb-4">Ask ATLAS</h2>
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Connect with ATLAS AI to assist with your project</p>
                  <Button variant="outline" className="mt-4">Start Conversation</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

interface EditProjectFormProps {
  project: Project;
  onSuccess: (project: Project) => void;
  onCancel: () => void;
}

function EditProjectForm({ project, onSuccess, onCancel }: EditProjectFormProps) {
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    status: project.status,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Maximum number of retry attempts
    const maxRetries = 2;
    let retryCount = 0;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        // Add validation
        if (!formData.name.trim()) {
          setError("Project name is required");
          toast.error("Validation Error", {
            description: "Project name is required"
          });
          break;
        }

        console.log(`Submitting project update (attempt ${retryCount + 1}/${maxRetries + 1}):`, formData);
        
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          // Handle non-JSON response (likely HTML error page)
          const text = await response.text();
          console.error("Received non-JSON response:", text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Project update response:", data);

        if (!response.ok) {
          const errorMessage = data.message || data.error || "Failed to update project";
          throw new Error(errorMessage);
        }

        // Success!
        success = true;
        toast.success("Project Updated", {
          description: "Project details have been updated successfully"
        });
        onSuccess(data);
        break;
      } catch (err) {
        console.error(`Error updating project (attempt ${retryCount + 1}/${maxRetries + 1}):`, err);
        
        // If we've reached max retries, show the error to the user
        if (retryCount === maxRetries) {
          const errorMessage = err instanceof Error ? err.message : "Failed to update project";
          setError(errorMessage);
          toast.error("Error", {
            description: errorMessage
          });
        } else {
          // Otherwise, increment retry count and try again after a delay
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
        }
      }
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogDescription>
          Make changes to your project details.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="name">Project Name</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ManageTeamFormProps {
  project: Project;
  onMemberAdded: (member: ProjectMember) => void;
  onMemberRemoved: (memberId: string) => void;
  onClose: () => void;
}

function ManageTeamForm({ project, onMemberAdded, onMemberRemoved, onClose }: ManageTeamFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search users');
      const data = await response.json();
      // Filter out users who are already members
      const existingMemberIds = project.members.map(m => m.user.id);
      setSearchResults(data.filter((user: User) => !existingMemberIds.includes(user.id)));
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      toast.error('Error', {
        description: 'Failed to search users'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Use effect with debounce for search
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, project.members]);

  const handleAddMember = async (user: User) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add team member");
      }

      // Clear search query and results after successful addition
      setSearchQuery("");
      setSearchResults([]);
      
      onMemberAdded(data);
    } catch (err) {
      console.error("Error adding team member:", err);
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to add team member"
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/members?memberId=${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to remove team member");
      }

      onMemberRemoved(memberId);
    } catch (err) {
      console.error("Error removing team member:", err);
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to remove team member"
      });
    }
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Manage Team</DialogTitle>
        <DialogDescription>
          Add or remove team members from your project.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label>Add Team Member</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search users by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setSearchResults([]);
                  }
                }}
                className="pr-8"
              />
              {isSearching && (
                <div className="absolute right-2 top-2">
                  <LucideLoader className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {searchQuery && !isSearching && (
                <div className="absolute right-2 top-2 cursor-pointer" onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <LucideX className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-black ring-opacity-5">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleAddMember(user)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{user.name || 'No name'}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="mt-2 text-sm text-muted-foreground">
              No users found. Try a different search term.
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Current Team Members</Label>
          <div className="space-y-2">
            {project.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getDisplayName(member)}</span>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {member.role.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{getEmail(member)}</span>
                  </div>
                </div>
                {/* Don't allow removing the project creator */}
                {member.user.id !== project.createdById && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <LucideX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 