"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LucideUpload, LucideFile, LucideTrash, LucideX, LucideArrowLeft } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";

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
  const projectId = params?.id as string;
  
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    if (projectId) {
      fetchFiles();
    }
  }, [projectId]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
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
    
    setUploads(prev => [...prev, ...newUploads]);
    
    // Process each file
    newUploads.forEach(upload => {
      simulateFileUpload(upload.id, newFiles.find(f => f.name === upload.name)!);
    });
  };

  const simulateFileUpload = (fileId: string, file: File) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 5;
      
      if (progress >= 100) {
        clearInterval(interval);
        
        setUploads(prev => 
          prev.map(upload => 
            upload.id === fileId 
              ? { ...upload, progress: 100, status: 'complete' } 
              : upload
          )
        );
        
        setTimeout(() => {
          // Remove completed upload from list after a short delay
          setUploads(prev => prev.filter(upload => upload.id !== fileId));
          
          // Add to files list and refresh
          fetchFiles();
          
          toast.success('File uploaded successfully');
        }, 2000);
      } else {
        setUploads(prev => 
          prev.map(upload => 
            upload.id === fileId 
              ? { ...upload, progress } 
              : upload
          )
        );
      }
    }, 300);
  };

  const handleRemoveUpload = (uploadId: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== uploadId));
  };

  const confirmDeleteFile = (fileId: string) => {
    setFileToDelete(fileId);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      // Simulate API call to delete file
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove file from state
      setFiles(prev => prev.filter(file => file.id !== fileToDelete));
      
      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    } finally {
      setFileToDelete(null);
    }
  };

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display">Project Documents</h1>
          <p className="text-muted-foreground mt-1">
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
        </CardHeader>
        <CardContent>
          {/* Show uploads if there are any */}
          {uploads.length > 0 && (
            <div className="mb-6 border rounded-md p-4 bg-muted/30">
              <h3 className="text-base font-medium mb-4">Uploading {uploads.length} file(s)</h3>
              <div className="space-y-3">
                {uploads.map(upload => (
                  <div key={upload.id} className="flex items-center gap-4">
                    <LucideFile className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{upload.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(upload.size)}
                        </span>
                      </div>
                      <Progress value={upload.progress} className="h-2" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => handleRemoveUpload(upload.id)}
                    >
                      <LucideX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Files List */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-4">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between gap-4 p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <LucideFile className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>&bull;</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <LucideTrash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{file.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => confirmDeleteFile(file.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LucideFile className="h-12 w-12 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No documents yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Upload documents to enhance your project assistant's knowledge base
              </p>
              <label htmlFor="file-upload">
                <Button asChild>
                  <span className="cursor-pointer">
                    <LucideUpload className="h-4 w-4 mr-2" />
                    Upload Your First Document
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete File Confirmation */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 