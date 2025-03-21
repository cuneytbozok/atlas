"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LucideUpload, LucideFile, LucideTrash, LucideX, LucideArrowLeft, LucideLoader } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  url?: string;
}

export default function ProjectDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const projectId = params?.id as string;
  
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canDeleteFiles, setCanDeleteFiles] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fileDeleting, setFileDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [project, setProject] = useState<{
    id: string;
    name: string;
    vectorStoreId: string | null;
    assistantId: string | null;
  } | null>(null);

  // Move formatFileSize to before it's used
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Memoize drag and drop event handlers
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

  // Define uploadFile first, then make handleFiles depend on it
  const uploadFile = useCallback(async (fileId: string, file: File) => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Update progress - start
      setUploads(prev => 
        prev.map(upload => 
          upload.id === fileId 
            ? { ...upload, progress: 20 } 
            : upload
        )
      );
      
      console.log(`Starting upload for ${file.name} (${formatFileSize(file.size)})`);
      
      // Call the API to upload the file
      let response;
      try {
        response = await fetch(`/api/projects/${projectId}/files/upload`, {
          method: 'POST',
          body: formData
        });
      } catch (networkError) {
        console.error('Network error during file upload:', networkError);
        throw new Error('Network error: Could not connect to the server');
      }
      
      // Mid-progress update
      setUploads(prev => 
        prev.map(upload => 
          upload.id === fileId 
            ? { ...upload, progress: 70 } 
            : upload
        )
      );
      
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          console.error('Upload API error:', errorData);
          errorMessage = errorData.error || errorData.details || 'Upload failed';
          if (errorData.failedFiles && errorData.failedFiles.length > 0) {
            errorMessage += ': ' + errorData.failedFiles[0].error;
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      // Update progress - complete
      setUploads(prev => 
        prev.map(upload => 
          upload.id === fileId 
            ? { ...upload, progress: 100, status: 'complete' } 
            : upload
        )
      );
      
      // Get the response data - only read the response body once
      let data;
      try {
        data = await response.json();
        console.log('Upload API response:', data);
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        throw new Error('Failed to parse server response');
      }
      
      // The API might return a single file or an array of files
      // Handle both cases to maintain backward compatibility
      const fileData = Array.isArray(data) ? data[0] : data;
      
      if (!fileData || !fileData.id) {
        console.error('Invalid file data received:', fileData);
        throw new Error('Server returned invalid file data');
      }
      
      // Show success message
      toast.success('File uploaded successfully', {
        description: `${file.name} has been uploaded to the project`
      });
      
      // Add the new file to the files state directly instead of fetching all files again
      setFiles(prev => [fileData, ...prev]);
      
      // Remove from uploads list after a delay
      setTimeout(() => {
        setUploads(prev => prev.filter(upload => upload.id !== fileId));
      }, 2000);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Update upload status to error
      setUploads(prev => 
        prev.map(upload => 
          upload.id === fileId 
            ? { 
                ...upload, 
                progress: 100, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed'
              } 
            : upload
        )
      );
      
      // Show error toast
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Failed to upload file'
      });
    }
  }, [projectId, formatFileSize]);

  // New function to handle batch upload of multiple files
  const uploadMultipleFiles = useCallback(async (uploads: FileUpload[], files: File[]) => {
    try {
      // Create form data with multiple files
      const formData = new FormData();
      files.forEach(file => {
        formData.append('file', file);
        console.log(`Adding file to batch: ${file.name} (${formatFileSize(file.size)})`);
      });
      
      console.log(`Starting batch upload of ${files.length} files`);
      
      // Update progress - start for all files
      setUploads(prev => 
        prev.map(upload => {
          const isInBatch = uploads.some(u => u.id === upload.id);
          return isInBatch 
            ? { ...upload, progress: 20 } 
            : upload;
        })
      );
      
      // Make a single API call with all files
      let response;
      try {
        response = await fetch(`/api/projects/${projectId}/files/upload`, {
          method: 'POST',
          body: formData
        });
      } catch (networkError) {
        console.error('Network error during batch upload:', networkError);
        throw new Error('Network error: Could not connect to the server');
      }
      
      // Mid-progress update for all files
      setUploads(prev => 
        prev.map(upload => {
          const isInBatch = uploads.some(u => u.id === upload.id);
          return isInBatch 
            ? { ...upload, progress: 70 } 
            : upload;
        })
      );
      
      if (!response.ok) {
        let errorMessage = 'Batch upload failed';
        try {
          const errorData = await response.json();
          console.error('Batch upload API error:', errorData);
          errorMessage = errorData.error || errorData.details || 'Batch upload failed';
          if (errorData.failedFiles && errorData.failedFiles.length > 0) {
            errorMessage += ': ' + errorData.failedFiles.map((f: any) => `${f.name} - ${f.error}`).join(', ');
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      // Get response data - should be an array of files - only read the response body once
      let data;
      try {
        data = await response.json();
        console.log('Batch upload API response:', data);
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        throw new Error('Failed to parse server response');
      }
      
      const uploadedFiles = Array.isArray(data) ? data : [data];
      
      if (!uploadedFiles.length || !uploadedFiles[0]?.id) {
        console.error('Invalid file data received:', uploadedFiles);
        throw new Error('Server returned invalid file data');
      }
      
      console.log(`Successfully uploaded ${uploadedFiles.length} files`);
      
      // Update progress - complete for all files
      setUploads(prev => 
        prev.map(upload => {
          const isInBatch = uploads.some(u => u.id === upload.id);
          return isInBatch 
            ? { ...upload, progress: 100, status: 'complete' } 
            : upload;
        })
      );
      
      // Add the new files to the files state
      setFiles(prev => [...uploadedFiles, ...prev]);
      
      // Show success message
      toast.success(`${uploadedFiles.length} files uploaded successfully`, {
        description: `The files have been uploaded to the project`
      });
      
      // Remove all uploads from list after a delay
      setTimeout(() => {
        setUploads(prev => 
          prev.filter(upload => !uploads.some(u => u.id === upload.id))
        );
      }, 2000);
      
    } catch (error) {
      console.error('Error in batch upload:', error);
      
      // Update status to error for all files in batch
      setUploads(prev => 
        prev.map(upload => {
          const isInBatch = uploads.some(u => u.id === upload.id);
          return isInBatch 
            ? { 
                ...upload, 
                progress: 100, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Batch upload failed'
              } 
            : upload;
        })
      );
      
      // Show error toast
      toast.error('Batch upload failed', {
        description: error instanceof Error ? error.message : 'Failed to upload files'
      });
    }
  }, [projectId, formatFileSize]);

  // Memoize the file upload functions with proper dependency
  const handleFiles = useCallback((newFiles: File[]) => {
    // For a single file, use the original method
    if (newFiles.length === 1) {
      const file = newFiles[0];
      const upload = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: 'uploading' as const
      };
      
      setUploads(prev => [...prev, upload]);
      uploadFile(upload.id, file);
      return;
    }
    
    // For multiple files, use batch upload
    const newUploads = newFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploads(prev => [...prev, ...newUploads]);
    
    // Use batch upload for multiple files
    uploadMultipleFiles(newUploads, newFiles);
  }, [uploadFile, uploadMultipleFiles]);

  // Move other handlers dependent on handleFiles after it
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  }, [handleFiles]);

  const handleRemoveUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id));
    toast.info('Upload removed');
  }, []);

  const confirmDeleteFile = useCallback((fileId: string) => {
    setFileToDelete(fileId);
  }, []);

  // Fetch files from database
  const fetchFiles = useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      console.log(`Fetching files for project ${projectId}`);
      
      // Use database API to get files
      const response = await fetch(`/api/projects/${projectId}/files`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(e => ({}));
        console.error('Error response from file fetch API:', errorData);
        const errorMsg = errorData.error || errorData.details || `Server returned ${response.status}: ${response.statusText}`;
        console.error('Error message:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const data = await response.json().catch(e => {
        console.error('Failed to parse file list response:', e);
        throw new Error('Invalid response format from server');
      });
      
      console.log(`Received file data:`, data);
      
      // Check if there's a warning message
      if (data.warning) {
        console.warn('Warning from API:', data.warning);
        toast.warning('Warning', {
          description: data.warning
        });
      }
      
      // Files now come directly from our database with correct format
      let formattedFiles: ProjectFile[] = [];
      
      // Handle both array response and data property format for backward compatibility
      const fileArray = Array.isArray(data) ? data : (data.data || []);
      
      if (fileArray.length > 0) {
        formattedFiles = fileArray.map((file: any) => ({
          id: file.id,
          openaiFileId: file.openaiFileId,
          name: file.name || file.filename || 'Unknown file',
          size: file.size || file.bytes || 0,
          type: file.type || file.mimeType || file.purpose || 'unknown',
          createdAt: file.createdAt || (file.created_at ? new Date(file.created_at * 1000).toISOString() : new Date().toISOString())
        }));
        
        console.log(`Processed ${formattedFiles.length} files from database`);
      } else {
        console.log('No files found for this project');
      }
      
      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    fetchFiles(true);
  }, [fetchFiles]);

  // Fetch project members to check if user is a project manager
  const checkProjectPermissions = useCallback(async () => {
    try {
      // Check if user is an admin (can always delete files)
      const isAdmin = hasRole('ADMIN');
      
      if (isAdmin) {
        setCanDeleteFiles(true);
        return;
      }
      
      // If not admin, check if user is a project manager for this project
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (!response.ok) {
        console.error('Failed to fetch project members');
        return;
      }
      
      const members = await response.json();
      
      // Find the current user in the project members
      const currentUserMember = members.find(
        (member: any) => member.user.id === user?.id
      );
      
      // Check if user is a project manager
      const isProjectManager = currentUserMember?.role?.name === 'PROJECT_MANAGER';
      
      setCanDeleteFiles(isAdmin || isProjectManager);
    } catch (error) {
      console.error('Error checking project permissions:', error);
    }
  }, [projectId, hasRole, user]);
  
  // Initialize only once when component mounts
  useEffect(() => {
    if (projectId) {
      // Load data only once when component mounts
      fetchFiles();
      checkProjectPermissions();
    }
  }, [projectId]); // Remove fetchFiles and checkProjectPermissions from dependencies

  // Set up an effect to check for permissions when the window regains focus
  useEffect(() => {
    const handleFocus = () => {
      checkProjectPermissions();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkProjectPermissions]);

  const handleRemoveFile = async (fileId: string) => {
    setFileToDelete(null);
    setFileDeleting(fileId);
    
    try {
      console.log(`Deleting file ${fileId} from project ${projectId}`);
      
      const response = await fetch(`/api/projects/${projectId}/files?fileId=${fileId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        let errorMessage = `${response.status} ${response.statusText}`;
        
        try {
          // Try to parse JSON error response
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage += `. ${errorData.error}`;
          }
        } catch (parseError) {
          // If it's not JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage += `. ${errorText}`;
            }
          } catch (textError) {
            // Ignore text parsing errors
          }
        }
        
        throw new Error(`Failed to delete file: ${errorMessage}`);
      }
      
      // Remove file from the files list
      setFiles(prev => prev.filter(file => file.id !== fileId));
      
      toast.success('File deleted successfully');
      
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setFileDeleting(null);
    }
  };

  // Get project details including AI resources
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch project details');
        }
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Upload and manage documents for your project
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}`} className="flex items-center gap-2">
            <LucideArrowLeft className="h-4 w-4" />
            Back to Project
          </Link>
        </Button>
      </div>
      
      {/* Warning if AI resources are missing */}
      {project && (!project.vectorStoreId || !project.assistantId) && (
        <Alert variant="default" className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertDescription className="flex justify-between items-center">
            <div>
              <p className="font-medium">AI Resources Missing</p>
              <p className="text-sm mt-1">
                This project doesn't have the necessary AI resources set up. 
                Documents can be uploaded, but AI-powered search and chat may not work correctly.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}#atlas-ai`}>
                View Details
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Combined Documents Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Documents</CardTitle>
              <CardDescription>
                Documents available for your project assistant
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || refreshing}
              >
                {refreshing ? 
                  <LucideLoader className="h-4 w-4 mr-2 animate-spin" /> : 
                  <LucideArrowLeft className="h-4 w-4 mr-2 rotate-[135deg]" />
                }
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Input
                type="file"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                  <span>
                    <LucideUpload className="h-4 w-4 mr-2" />
                    Upload Files
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center mb-6 transition-colors ${
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
            <p className="text-sm font-medium">Drag and drop files here</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, TXT, and other documents (max 20MB)
            </p>
          </div>
          
          {/* Files List */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              Files in Vector Store
              {(isLoading || refreshing) && (
                <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
              )}
            </h3>
            
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No files found in the vector store. Upload files to make them available to your project assistant.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <LucideFile className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium truncate max-w-[300px]">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {canDeleteFiles && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmDeleteFile(file.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <LucideTrash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* File uploads display */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploads</CardTitle>
            <CardDescription>
              Files being uploaded to your project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploads.map(upload => (
                <div key={upload.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <LucideFile className="h-4 w-4 text-primary" />
                      <span className="font-medium">{upload.name}</span>
                    </div>
                    
                    {upload.status === 'uploading' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUpload(upload.id)}
                        className="h-6 w-6 p-0"
                      >
                        <LucideX className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Progress value={upload.progress} className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(upload.size)}
                    </span>
                  </div>
                  
                  {upload.status === 'error' && (
                    <div className="mt-2">
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription className="text-xs">
                          {upload.error || 'Upload failed'}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={fileToDelete !== null} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleRemoveFile(fileToDelete as string)}
              disabled={deleteInProgress}
            >
              {deleteInProgress ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 