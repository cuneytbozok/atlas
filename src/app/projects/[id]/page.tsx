"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams, useRouter } from "next/navigation";
import { LucideCalendar, LucideUsers, LucideFileText, LucideLoader, LucideSearch, LucideUserPlus, LucideX, LucideUpload, LucideFile, LucideTrash, LucideSettings, LucideBrain, LucideMessageSquare, MessagesSquare, LucidePencil } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useProject } from "./layout";

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
  vectorStoreId: string;
  assistantId: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

// Helper functions for member data
const safeCharAt = (str: string | null | undefined, index: number): string => {
  return (str && str.length > index) ? str.charAt(index).toUpperCase() : '';
};

const getInitials = (member: ProjectMember): string => {
  const name = member.user.name;
  return name ? 
    `${safeCharAt(name, 0)}${safeCharAt(name.split(' ')[1], 0)}` : 
    safeCharAt(member.user.email, 0);
};

const getDisplayName = (member: ProjectMember): string => {
  return member.user.name || member.user.email;
};

const getEmail = (member: ProjectMember): string => {
  return member.user.email;
};

// Helper function to find the project manager in a project
const findProjectManager = (project: Project): ProjectMember | null => {
  if (project.projectManager) return project.projectManager;
  
  if (project.members) {
    // Find the member with PROJECT_MANAGER role
    return project.members.find(member => 
      member.role && member.role.name === "PROJECT_MANAGER"
    ) || null;
  }
  
  return null;
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

// Helper function to format AI resource cleanup status
const getCleanupStatus = (cleanup: { assistantDeleted: boolean; vectorStoreDeleted: boolean }) => {
  const statuses: string[] = [];
  
  if (cleanup.assistantDeleted) {
    statuses.push("Assistant deleted");
  }
  
  if (cleanup.vectorStoreDeleted) {
    statuses.push("Vector store deleted");
  }
  
  if (statuses.length === 0) {
    return "No AI resources to clean up";
  }
  
  return statuses.join(", ");
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { hasRole, user } = useAuth();
  const projectId = params?.id as string;
  const { project, isLoading, error, refreshProject } = useProject();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageTeamDialogOpen, setIsManageTeamDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteInProgress, setIsDeleteInProgress] = useState(false);
  const [deletionStage, setDeletionStage] = useState<string>("");
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingAiResources, setIsCreatingAiResources] = useState(false);
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteSteps, setDeleteSteps] = useState<Array<{
    id: string;
    label: string;
    status: 'pending' | 'inProgress' | 'completed' | 'error';
  }>>([]);
  const [canManageFiles, setCanManageFiles] = useState(false);
  const [canEditProject, setCanEditProject] = useState(false);
  const [canDeleteProject, setCanDeleteProject] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    assistant: { id: string, openaiId: string | null } | null;
    vectorStore: { id: string, openaiId: string | null } | null;
  }>({ assistant: null, vectorStore: null });
  const [isLoadingDebugInfo, setIsLoadingDebugInfo] = useState(false);

  // Add effect to scroll to ATLAS AI section when hash is present
  useEffect(() => {
    // Check if the URL has a hash and it's #atlas-ai
    if (typeof window !== 'undefined' && window.location.hash === '#atlas-ai') {
      // Find the element
      const atlasAiSection = document.getElementById('atlas-ai');
      if (atlasAiSection) {
        // Scroll to the element with smooth behavior
        atlasAiSection.scrollIntoView({ behavior: 'smooth' });
        
        // Add a slight delay and highlight effect
        setTimeout(() => {
          atlasAiSection.classList.add('bg-primary/5');
          setTimeout(() => {
            atlasAiSection.classList.remove('bg-primary/5');
          }, 1000);
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    if (project && user) {
      // Check user permissions
      const checkPermissions = async () => {
        // Admin can always manage files and edit project
        const isAdmin = hasRole('ADMIN');
        
        // Check if user is a project manager
        const isProjectManager = project.projectManager?.user.id === user.id;
        
        // Check if user is the project creator
        const isCreator = project.createdById === user.id;
        
        setCanManageFiles(isAdmin || isProjectManager);
        setCanEditProject(isAdmin || isProjectManager);
        setCanDeleteProject(isAdmin || isProjectManager || isCreator);
      };
      
      checkPermissions();
    }
  }, [project, user, hasRole]);

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
    const uploads = newFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'uploading' as const
    }));

    setFileUploads(prev => [...prev, ...uploads]);

    // Upload each file
    uploads.forEach(fileUpload => {
      uploadFileToProject(fileUpload.id, newFiles.find(f => f.name === fileUpload.name)!);
    });
  };

  const uploadFileToProject = async (fileId: string, file: File) => {
    try {
      // Set initial progress
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 10 } 
            : item
        )
      );
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Set mid progress
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 40 } 
            : item
        )
      );
      
      // Upload to API
      const response = await fetch(`/api/projects/${projectId}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      
      // Set almost complete progress
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 90 } 
            : item
        )
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      // Process response
      const data = await response.json();
      
      // Complete the upload
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 100, status: 'complete' } 
            : item
        )
      );
      
      // Show success message
      toast.success("File uploaded", {
        description: `${file.name} has been uploaded successfully`
      });
      
      // Refresh project data to include the new file
      refreshProject();
      
      // Remove successfully uploaded file from display after a delay
      setTimeout(() => {
        setFileUploads(prev => prev.filter(item => item.id !== fileId));
      }, 3000);
    } catch (error) {
      console.error("Error uploading file:", error);
      
      // Update file upload status to error
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { 
                ...item, 
                progress: 100, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed'
              } 
            : item
        )
      );
      
      // Show error toast
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : 'Failed to upload file'
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFileUploads(prev => prev.filter(item => item.id !== fileId));
    toast.info("File removed");
  };

  // Helper function to update a deletion step's status
  const updateDeletionStep = (stepId: string, status: 'pending' | 'inProgress' | 'completed' | 'error') => {
    setDeleteSteps(steps => 
      steps.map(step => 
        step.id === stepId 
          ? { ...step, status } 
          : step
      )
    );
  };

  const handleProjectUpdated = () => {
    refreshProject();
    
    // Show a more comprehensive success message
    toast.success("Project Updated", {
      description: "Project details and AI assistant have been updated successfully"
    });
    
    setIsEditDialogOpen(false);
  };

  const handleMemberAdded = (newMember: ProjectMember) => {
    refreshProject();
    toast.success("Team member added successfully");
  };

  const handleMemberRemoved = (memberId: string) => {
    refreshProject();
    toast.success("Team member removed successfully");
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    
    setIsDeleting(true);
    setIsDeleteInProgress(true);
    setDeletionStage("Preparing to delete project...");
    
    try {
      // Set up the deletion steps
      setDeleteSteps([
        { id: 'project', label: 'Deleting project and associated resources', status: 'inProgress' },
      ]);
      
      setDeletionStage("Deleting project and associated resources...");
      
      // Delete project (the API will handle assistant and vector store deletion)
      const projectResp = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE'
      });
      
      if (!projectResp.ok) {
        const errorData = await projectResp.json();
        throw new Error(errorData.message || 'Failed to delete project');
      }
      
      // Mark all steps as completed
      setDeleteSteps(steps => 
        steps.map(step => ({ ...step, status: 'completed' }))
      );
      
      setDeletionStage("Project deleted successfully!");
      
      // Show success message
      toast.success("Project deleted successfully");
      
      // Short delay before redirecting to allow user to see the success state
      setTimeout(() => {
        // Navigate back to projects list
        router.push('/projects');
      }, 1500);
      
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error("Failed to delete project", {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Mark current step as error
      setDeleteSteps(steps => 
        steps.map(step => ({ ...step, status: 'error' }))
      );
      
      setDeletionStage("Error deleting project: " + (error instanceof Error ? error.message : 'Unknown error'));
      setIsDeleting(false);
    }
  };

  // Fetch detailed debug info when modal is opened
  useEffect(() => {
    if (isDebugModalOpen && project) {
      const fetchDebugInfo = async () => {
        setIsLoadingDebugInfo(true);
        try {
          let assistantInfo = null;
          let vectorStoreInfo = null;
          
          // Fetch assistant info if exists
          if (project.assistantId) {
            const assistantResponse = await fetch(`/api/assistants/${project.assistantId}`);
            if (assistantResponse.ok) {
              const assistantData = await assistantResponse.json();
              assistantInfo = {
                id: assistantData.id,
                openaiId: assistantData.openaiAssistantId
              };
            }
          }
          
          // Fetch vector store info if exists
          if (project.vectorStoreId) {
            const vectorStoreResponse = await fetch(`/api/vector-stores/${project.vectorStoreId}`);
            if (vectorStoreResponse.ok) {
              const vectorStoreData = await vectorStoreResponse.json();
              vectorStoreInfo = {
                id: vectorStoreData.id,
                openaiId: vectorStoreData.openaiVectorStoreId
              };
            }
          }
          
          setDebugInfo({
            assistant: assistantInfo,
            vectorStore: vectorStoreInfo
          });
        } catch (error) {
          console.error("Error fetching debug info:", error);
        } finally {
          setIsLoadingDebugInfo(false);
        }
      };
      
      fetchDebugInfo();
    }
  }, [isDebugModalOpen, project]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LucideLoader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h1 className="text-h1 mb-2">Project Not Found</h1>
              <p className="text-muted-foreground mb-4">
            {error || "The project you are looking for does not exist or has been removed."}
              </p>
              <Button asChild>
                <Link href="/projects">Back to Projects</Link>
              </Button>
            </div>
          </div>
    );
  }

  const formattedCreatedDate = new Date(project.createdAt).toLocaleDateString();
  const formattedUpdatedDate = new Date(project.updatedAt).toLocaleDateString();

  // Main return for the project page
  return (
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-h2">{project.name}</h2>
            {project.status && (
                <div className={`rounded-full px-3 py-1 text-sm ${
                  project.status === "active" 
                    ? "bg-success/20 text-success" 
                    : project.status === "completed" 
                    ? "bg-tertiary/20 text-tertiary"
                    : "bg-warning/20 text-warning"
                }`}>
                  {safeCharAt(project.status, 0).toUpperCase() + project.status.slice(1)}
                </div>
              )}
          </div>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href={`/projects/${project.id}/chat`}>
              <MessagesSquare className="h-4 w-4 mr-2" />
              Chat
            </Link>
          </Button>
          
          {canEditProject && (
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(true)}
            >
              <LucidePencil className="mr-2 h-4 w-4" />
              Edit Project
            </Button>
          )}

          {canDeleteProject && (
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <LucideTrash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-3">
    <Card className="h-auto">
          <CardHeader className="pb-2">
            <div className="mb-2">
          <LucideFileText className="h-5 w-5 text-muted-foreground" />
            </div>
        <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
            <p className="mt-1">{safeCharAt(project.status, 0) + (project.status.slice(1) || '')}</p>
              </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
            <p className="mt-1">{project.createdBy.name || project.createdBy.email}</p>
          </div>
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

    <Card className="h-auto">
          <CardHeader className="pb-2">
            <div className="mb-2">
              <LucideUsers className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
        <div className="space-y-3">
          {(() => {
            const projectManager = findProjectManager(project as Project);
            return projectManager && (
              <div className="border-b pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(projectManager)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{getDisplayName(projectManager)}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Project Manager</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{getEmail(projectManager)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {project.members && Array.isArray(project.members) && project.members.length > 0 ? (
            <>
              {(() => {
                const projectManager = findProjectManager(project as Project);
                return project.members
                  .filter(member => !projectManager || member.id !== projectManager.id)
                  .slice(0, 3)
                  .map((member, index) => (
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
                  ));
              })()}
              
              {(() => {
                const projectManager = findProjectManager(project as Project);
                const filteredMembers = project.members.filter(member => !projectManager || member.id !== projectManager.id);
                return filteredMembers.length > 3 && (
                  <div className="text-sm text-muted-foreground mt-2">
                    +{filteredMembers.length - 3} more team members
                  </div>
                );
              })()}
            </>
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
                project={{
                  id: project.id,
                  name: project.name,
                  members: project.members,
                  projectManager: findProjectManager(project as Project)
                }} 
                onMemberAdded={handleMemberAdded}
                onMemberRemoved={handleMemberRemoved}
                onClose={() => setIsManageTeamDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
            </div>
          </CardContent>
        </Card>

    <Card className="h-auto">
          <CardHeader className="pb-2">
            <div className="mb-2">
          <LucideUpload className="h-5 w-5 text-muted-foreground" />
            </div>
        <CardTitle className="text-base">Files</CardTitle>
          </CardHeader>
          <CardContent>
        <div 
          className={`border-2 border-dashed rounded-lg p-3 text-center mb-3 transition-colors ${
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/20 hover:border-primary/50"
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <LucideUpload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground mb-1">
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

        {fileUploads.length > 0 && (
          <div className="mt-3 space-y-2">
            {fileUploads.map(file => (
              <div key={file.id} className="border rounded-md p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 truncate">
                    <LucideFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  {canManageFiles && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <LucideTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="w-full">
                  <Progress value={file.progress} className="h-1" />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <span className={`text-xs ${file.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {file.status === 'uploading' 
                      ? `${file.progress}%` 
                      : file.status === 'complete' 
                        ? 'Complete' 
                        : 'Error'}
                  </span>
                </div>
                {file.status === 'error' && file.error && (
                  <div className="mt-1 text-xs text-destructive">
                    {file.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Add a button to view all files */}
        <div className="mt-4">
          <Button variant="outline" asChild className="w-full">
            <Link href={`/projects/${projectId}/documents`} className="flex items-center justify-center gap-2">
              <LucideFileText className="h-4 w-4" />
              View All Files
            </Link>
          </Button>
        </div>
          </CardContent>
        </Card>
      </div>

    {/* Remove the "Ask ATLAS" section and replace with a direct link to chat */}
    <div className="mt-6 flex flex-col md:flex-row gap-4">
      <Card className="md:w-1/2">
        <CardHeader className="pb-2">
          <div className="mb-2">
            <LucideMessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
          <CardTitle className="text-base">Chat with ATLAS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            Chat with your AI assistant about this project and its documents
          </div>
          
          <Button asChild className="w-full">
            <Link href={`/projects/${project.id}/chat`} className="flex items-center justify-center gap-2">
              <LucideMessageSquare className="h-4 w-4" />
              Open Chat
            </Link>
          </Button>
            </CardContent>
          </Card>
      
      <Card className="md:w-1/2">
        <CardHeader className="pb-2">
          <div className="mb-2">
            <LucideFileText className="h-5 w-5 text-muted-foreground" />
        </div>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            Access and manage all documents related to this project
      </div>
          
          <Button asChild className="w-full">
            <Link href={`/projects/${project.id}/documents`} className="flex items-center justify-center gap-2">
              <LucideFileText className="h-4 w-4" />
              View Documents
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>

    {/* Add the enhanced deletion progress dialog */}
    <Dialog open={isDeleteInProgress} onOpenChange={(open) => {
      // Only allow closing this dialog when deletion is not in progress
      if (!isDeleting) setIsDeleteInProgress(open);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deleting Project</DialogTitle>
          <DialogDescription>
            Please wait while we delete the project and its associated resources.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <LucideLoader className="h-5 w-5 animate-spin text-primary" />
              <p className="font-medium">{deletionStage}</p>
            </div>
            
            {/* Step-by-step progress */}
            <div className="space-y-3">
              {deleteSteps.map(step => (
                <div key={step.id} className="flex items-center gap-3">
                  {step.status === 'pending' && (
                    <div className="h-5 w-5 rounded-full border border-muted-foreground/30" />
                  )}
                  {step.status === 'inProgress' && (
                    <LucideLoader className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {step.status === 'completed' && (
                    <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {step.status === 'error' && (
                    <div className="h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 3L3 9M3 3L9 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  <p className={`text-sm ${
                    step.status === 'completed' 
                      ? 'text-muted-foreground line-through' 
                      : step.status === 'error' 
                        ? 'text-destructive' 
                        : step.status === 'inProgress' 
                          ? 'text-primary' 
                          : 'text-muted-foreground'
                  }`}>{step.label}</p>
                </div>
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Deleting AI resources from OpenAI can take some time. Please do not close this window.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={() => setIsDeleteInProgress(false)}
            disabled={isDeleting}
            variant={isDeleting ? "outline" : "default"}
          >
            {isDeleting ? "Deleting..." : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialogs */}
    {canEditProject && (
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <EditProjectForm 
            project={project as Project} 
            onSuccess={handleProjectUpdated} 
            onCancel={() => setIsEditDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    )}

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the project
            and all associated data.
          </AlertDialogDescription>
          <div className="mt-4 p-3 bg-muted rounded-md text-sm">
            <p className="font-medium mb-2">The following will be deleted:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Project data and settings</li>
              <li>Team member associations</li>
              <li>All chat history and interactions</li>
              {project.vectorStoreId && (
                <li>
                  Associated vector store{" "}
                  <span className="text-xs opacity-70">(used for file search)</span>
                </li>
              )}
              {project.assistantId && (
                <li>
                  Associated assistant{" "}
                  <span className="text-xs opacity-70">(AI chat capabilities)</span>
                </li>
              )}
            </ul>
          </div>
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
    
    {hasRole("ADMIN") && (
      <Dialog open={isDebugModalOpen} onOpenChange={setIsDebugModalOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <LucideSettings className="h-4 w-4 mr-2" />
            Debug Info
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Project Debug Information</DialogTitle>
            <DialogDescription>
              Technical details for this project's AI resources
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {isLoadingDebugInfo ? (
              <div className="flex items-center justify-center py-4">
                <LucideLoader className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-medium mb-1">Database IDs</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Vector Store ID:</span>
                      <code className="block p-2 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                        {project.vectorStoreId || "Not available"}
                      </code>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Assistant ID:</span>
                      <code className="block p-2 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                        {project.assistantId || "Not available"}
                      </code>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-1">OpenAI IDs</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Vector Store OpenAI ID:</span>
                      <code className="block p-2 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                        {debugInfo.vectorStore?.openaiId || "Not available"}
                      </code>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Assistant OpenAI ID:</span>
                      <code className="block p-2 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                        {debugInfo.assistant?.openaiId || "Not available"}
                      </code>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )}
  </div>
);
}

interface EditProjectFormProps {
  project: Project;
  onSuccess: (project: Project) => void;
  onCancel: () => void;
}

function EditProjectForm({ project, onSuccess, onCancel }: EditProjectFormProps) {
  const projectManager = findProjectManager(project);
  
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    status: project.status,
    projectManagerId: projectManager?.user.id || ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>(project.members || []);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedManager, setSelectedManager] = useState<User | null>(
    projectManager ? {
      id: projectManager.user.id,
      name: projectManager.user.name,
      email: projectManager.user.email,
      image: projectManager.user.image
    } : null
  );

  // Fetch team members when the component mounts
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await fetch(`/api/projects/${project.id}/members`);
        if (!response.ok) throw new Error('Failed to fetch team members');
        const data = await response.json();
        setTeamMembers(data);
      } catch (err) {
        console.error('Error fetching team members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [project.id]);

  // Update form data when project changes
  useEffect(() => {
    // Get project manager using helper function
    const projectManager = findProjectManager(project);
    
    setFormData({
      name: project.name,
      description: project.description || "",
      status: project.status,
      projectManagerId: projectManager?.user.id || ""
    });
    
    setSelectedManager(projectManager ? {
      id: projectManager.user.id,
      name: projectManager.user.name,
      email: projectManager.user.email,
      image: projectManager.user.image
    } : null);
  }, [project]);

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

  const handleSearch = async (query: string) => {
    setManagerSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Failed to search users");
      
      const users = await response.json();
      setSearchResults(users);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectManager = (user: User) => {
    setSelectedManager(user);
    setFormData(prev => ({
      ...prev,
      projectManagerId: user.id
    }));
    setManagerSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveManager = () => {
    setSelectedManager(null);
    setFormData(prev => ({
      ...prev,
      projectManagerId: ""
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
        
        if (!formData.description.trim()) {
          setError("Project description is required");
          toast.error("Validation Error", {
            description: "Project description is required"
          });
          break;
        }

        // Create a copy of the form data to modify before sending
        const dataToSend = { ...formData };

        console.log(`Submitting project update (attempt ${retryCount + 1}/${maxRetries + 1}):`, dataToSend);
        
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSend),
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
          <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            required
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
        <div className="grid gap-2">
          <Label htmlFor="projectManager">Project Manager</Label>
          <div className="relative">
            <Input 
              placeholder="Search for a project manager" 
              value={managerSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pr-8"
            />
            {isSearching && (
              <div className="absolute right-2 top-2">
                <LucideLoader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-black ring-opacity-5">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelectManager(user)}
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
          {selectedManager && (
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm">
                <span>{selectedManager.name || selectedManager.email} (Project Manager)</span>
                <button 
                  type="button" 
                  className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={handleRemoveManager}
                >
                  ×
                </button>
              </div>
            </div>
          )}
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
  project: {
    id: string;
    name: string;
    members: ProjectMember[];
    projectManager?: ProjectMember | null;
  };
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
      const response = await fetch(`/api/projects/${project.id}/members/${memberId}`, {
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
          Add or remove team members from this project.
        </DialogDescription>
      </DialogHeader>
      
      <div className="mt-4 space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="search-user">Add Team Member</Label>
            <div className="flex gap-2">
              <Input
                id="search-user"
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              {searchQuery && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSearchQuery("")}
                >
                  <LucideX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {isSearching && (
            <div className="flex justify-center py-2">
              <LucideLoader className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          
          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleAddMember(user)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-2 text-sm text-muted-foreground">
              No users found. Try a different search term.
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Current Team Members</h3>
          
          {project.members.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No team members yet
            </div>
          ) : (
            <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
              {project.projectManager && (
                <div className="flex items-center justify-between p-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {getInitials(project.projectManager)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium">{getDisplayName(project.projectManager)}</p>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Project Manager</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{getEmail(project.projectManager)}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {project.members
                .filter(member => !project.projectManager || member.id !== project.projectManager.id)
                .map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{getDisplayName(member)}</p>
                        <p className="text-xs text-muted-foreground">{getEmail(member)}</p>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <LucideTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const k = 1024;
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 