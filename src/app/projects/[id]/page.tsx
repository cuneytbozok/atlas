"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams, useRouter } from "next/navigation";
import { LucideCalendar, LucideUsers, LucideFileText, LucideLoader, LucideSearch, LucideUserPlus, LucideX, LucideUpload, LucideFile, LucideTrash, LucideSettings } from "lucide-react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useEffect, useState, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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
  projectManager?: ProjectMember | null;
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

// Add a FileUpload interface
interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

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
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // File upload handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
      // Reset the input value so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const newUploads = newFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'uploading' as const
    }));

    setFiles(prev => [...prev, ...newUploads]);

    // Simulate upload progress for each file
    newUploads.forEach(fileUpload => {
      simulateFileUpload(fileUpload.id);
    });
  };

  const simulateFileUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 5;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setFiles(prev => 
          prev.map(file => 
            file.id === fileId 
              ? { ...file, progress: 100, status: 'complete' } 
              : file
          )
        );
        
        toast.success("File uploaded", {
          description: "File has been uploaded successfully"
        });
      } else {
        setFiles(prev => 
          prev.map(file => 
            file.id === fileId 
              ? { ...file, progress } 
              : file
          )
        );
      }
    }, 300);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
    toast.info("File removed");
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch project");
        }

        const data = await response.json();
        
        // Find the project manager (member with PROJECT_MANAGER role)
        const projectManager = data.members.find(
          (member: ProjectMember) => member.role.name === "PROJECT_MANAGER"
        ) || null;

        setProject({
          ...data,
          projectManager
        });
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to fetch project");
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
                  <LucideUpload className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 text-center mb-4 transition-colors ${
                    isDragging 
                      ? "border-primary bg-primary/5" 
                      : "border-muted-foreground/20 hover:border-primary/50"
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <LucideUpload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop files here or
                  </p>
                  <div>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" size="sm" type="button" onClick={() => document.getElementById('file-upload')?.click()}>
                        Browse Files
                      </Button>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInputChange}
                      />
                    </label>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {files.map(file => (
                      <div key={file.id} className="border rounded-md p-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 truncate">
                            <LucideFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleRemoveFile(file.id)}
                          >
                            <LucideTrash className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="w-full">
                          <Progress value={file.progress} className="h-1" />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {file.status === 'uploading' 
                              ? `${file.progress}%` 
                              : file.status === 'complete' 
                                ? 'Complete' 
                                : 'Error'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                    <p className="mt-1">{safeCharAt(project.status, 0) + (project.status.slice(1) || '')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                    <p className="mt-1">{project.createdBy.name || project.createdBy.email}</p>
                  </div>
                  {project.projectManager && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Project Manager</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>
                            {getInitials(project.projectManager)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{getDisplayName(project.projectManager)}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
                    <p className="mt-1">{formattedCreatedDate}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
                    <p className="mt-1">{formattedUpdatedDate}</p>
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
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roles, setRoles] = useState<{id: string, name: string, displayName: string, description: string | null}[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Fetch project roles when the role dialog opens
  useEffect(() => {
    if (isRoleDialogOpen) {
      fetchRoles();
    }
  }, [isRoleDialogOpen]);

  // Fetch available roles from the database
  const fetchRoles = async () => {
    setIsLoadingRoles(true);
    try {
      // Fetch roles from the database with project context
      const response = await fetch('/api/roles?context=project');
      
      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }
      
      const projectRoles = await response.json();
      setRoles(projectRoles);
    } catch (err) {
      console.error("Error fetching roles:", err);
      
      // Fallback to hardcoded roles if API fails
      const fallbackRoles = [
        { id: "ADMIN", name: "ADMIN", displayName: "Administrator", description: "Full access to the project" },
        { id: "PROJECT_MANAGER", name: "PROJECT_MANAGER", displayName: "Project Manager", description: "Can manage the project" },
        { id: "USER", name: "USER", displayName: "Team Member", description: "Regular team member" }
      ];
      
      setRoles(fallbackRoles);
      
      toast.error("Error", {
        description: "Failed to fetch roles, using default values"
      });
    } finally {
      setIsLoadingRoles(false);
    }
  };

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

  const handleUpdateRole = async (roleId: string) => {
    if (!selectedMember) return;
    
    setIsUpdatingRole(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/members/${selectedMember.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update member role");
      }

      const data = await response.json();
      
      // Update the member in the project
      const updatedMembers = project.members.map(member => {
        if (member.id === selectedMember.id) {
          return {
            ...member,
            role: data.role
          };
        }
        return member;
      });
      
      // Update project with new members
      project.members = updatedMembers;
      
      // Update project manager if needed
      if (data.role.name === "PROJECT_MANAGER") {
        project.projectManager = {
          ...selectedMember,
          role: data.role
        };
      } else if (selectedMember.role.name === "PROJECT_MANAGER") {
        project.projectManager = null;
      }
      
      toast.success("Member role updated successfully");
      setIsRoleDialogOpen(false);
    } catch (err) {
      console.error("Error updating member role:", err);
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to update member role"
      });
    } finally {
      setIsUpdatingRole(false);
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
          {project.members && project.members.length > 0 ? (
            <div className="space-y-2">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {getInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{getDisplayName(member)}</div>
                      <div className="text-sm text-muted-foreground">{getEmail(member)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role.name === "PROJECT_MANAGER" ? "default" : "outline"}>
                      {member.role.name}
                    </Badge>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setSelectedMember(member);
                          setIsRoleDialogOpen(true);
                        }}
                      >
                        <LucideSettings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <LucideX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No team members yet. Add members using the search above.
            </div>
          )}
        </div>
      </div>

      {/* Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              {selectedMember && `Update role for ${getDisplayName(selectedMember)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                defaultValue={selectedMember?.role.id} 
                onValueChange={(value) => handleUpdateRole(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingRoles ? (
                    <div className="flex items-center justify-center p-2">
                      <LucideLoader className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                      <span className="text-sm">Loading roles...</span>
                    </div>
                  ) : (
                    roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName || role.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              disabled={isUpdatingRole}
              onClick={() => {
                if (selectedMember && selectedMember.role.id) {
                  handleUpdateRole(selectedMember.role.id);
                }
              }}
            >
              {isUpdatingRole ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 