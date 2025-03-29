"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  LucideFileText, 
  LucideMessageSquare, 
  LucideBrain,
  LucideUpload,
  LucideFile,
  LucideTrash,
  LucideLoader
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { toast } from "sonner";

interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ProjectStatsProps {
  projectId: string;
  documentsCount: number;
  onUploadClick?: () => void;
  fileUploads?: FileUpload[];
  handleRemoveFile?: (fileId: string) => void;
}

interface ProjectStats {
  aiInteractionsCount: number;
}

export function ProjectStats({ projectId, documentsCount, onUploadClick, fileUploads, handleRemoveFile }: ProjectStatsProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now()); // For resetting file input
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch threads and AI interactions
        let aiInteractionsCount = 0;

        try {
          // First try a direct approach to get assistant messages
          const directResponse = await fetch(`/api/projects/${projectId}/messages?role=assistant`);
          if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log('Direct API response:', directData);
            
            if (directData && typeof directData.total === 'number') {
              aiInteractionsCount = directData.total;
              console.log('Using direct count method:', aiInteractionsCount);
            }
          }
          
          // If direct approach didn't work, try the thread-based approach
          if (aiInteractionsCount === 0) {
            console.log('Direct count failed, trying thread-based approach');
            const threadsResponse = await fetch(`/api/projects/${projectId}/threads`);
            if (threadsResponse.ok) {
              const threadsData = await threadsResponse.json();
              console.log('Threads data:', threadsData);
              
              if (Array.isArray(threadsData)) {
                // Log all thread IDs and their message counts
                threadsData.forEach(thread => {
                  console.log(`Thread ${thread.id}: `, {
                    totalMessages: thread._count?.messages || 0,
                    assistantMessages: thread._count?.assistantMessages || 'unknown'
                  });
                });
                
                // Try to get a more accurate count of assistant messages
                const messagesPromises = threadsData.map(thread => 
                  fetch(`/api/threads/${thread.id}/messages?role=assistant`)
                    .then(res => {
                      if (res.ok) return res.json();
                      console.log(`Failed to fetch assistant messages for thread ${thread.id}`);
                      return { total: 0 };
                    })
                    .then(data => {
                      console.log(`Thread ${thread.id} assistant messages:`, data);
                      return data.total || 0;
                    })
                    .catch(err => {
                      console.error(`Error fetching messages for thread ${thread.id}:`, err);
                      return 0;
                    })
                );
                
                // Sum up the AI interaction counts from all threads
                const messageCounts = await Promise.all(messagesPromises);
                console.log('Message counts by thread:', messageCounts);
                aiInteractionsCount = messageCounts.reduce((sum, count) => sum + count, 0);
                console.log('Total from thread messages:', aiInteractionsCount);
                
                // If for some reason we get 0, fall back to the approximation method
                if (aiInteractionsCount === 0) {
                  console.log('Using fallback approximation method');
                  aiInteractionsCount = threadsData.reduce((total, thread) => {
                    // If there's a specific count for assistant messages, use that
                    if (thread._count?.assistantMessages) {
                      return total + thread._count.assistantMessages;
                    }
                    // Otherwise use the approximation of half the messages
                    const approximation = Math.floor((thread._count?.messages || 0) / 2);
                    console.log(`Thread ${thread.id} approximation:`, approximation);
                    return total + approximation;
                  }, 0);
                }
              }
            } else {
              console.error('Failed to fetch threads:', threadsResponse.status);
            }
          }
          
          console.log('Final AI Interactions count:', aiInteractionsCount);
        } catch (err) {
          console.error('Error fetching message stats:', err);
          // Don't throw here, we can still show other stats
        }

        setStats({
          aiInteractionsCount
        });
      } catch (err) {
        console.error('Error fetching project stats:', err);
        setError('Failed to load project statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [projectId]);
  
  // File drag and drop handlers
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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onUploadClick) {
        // Dispatch a custom event with the files to be handled by the parent component
        // This avoids the need to click the file input element and directly processes the files
        const customEvent = new CustomEvent('filesdropped', {
          detail: { files: e.dataTransfer.files }
        });
        window.dispatchEvent(customEvent);
        
        // Show a toast to indicate files were received
        toast.info(`Processing ${e.dataTransfer.files.length} file(s)...`);
      } else {
        // Handle dropped files directly if no external handler
        const droppedFiles = Array.from(e.dataTransfer.files);
        toast.info(`${droppedFiles.length} files selected`, {
          description: 'Please use the upload button in the documents section'
        });
      }
    }
  }, [onUploadClick]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (onUploadClick) {
      onUploadClick();
    } else {
      // Default handling if onUploadClick is not provided
      toast.info('File selected', {
        description: 'Please use the upload button in the documents section to upload this file'
      });
    }
    
    // Reset the file input
    setFileInputKey(Date.now());
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array(3).fill(0).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Stats unavailable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Documents card */}
        <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                  <LucideFileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-8"
                    onClick={() => setIsUploadDialogOpen(true)}
                  >
                    <LucideUpload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    className="text-xs h-8"
                  >
                    <Link href={`/projects/${projectId}/documents`}>
                      <LucideFileText className="mr-2 h-4 w-4" />
                      View All Files
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div 
                className={`flex flex-col justify-between border-2 border-dashed rounded-md p-3 transition-colors cursor-pointer ${
                  isDragging 
                    ? "border-primary bg-primary/10" 
                    : "border-muted-foreground/20 hover:border-primary/40"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={onUploadClick}
              >
                {isDragging ? (
                  <div className="flex flex-col items-center justify-center py-2">
                    <LucideUpload className="h-5 w-5 text-primary animate-bounce mb-1" />
                    <span className="text-sm text-primary font-medium">Drop files to upload</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {documentsCount.toLocaleString()}
                        </h3>
                        <Badge variant="outline">
                          {documentsCount === 1 ? 'Document' : 'Documents'}
                        </Badge>
                        {fileUploads && fileUploads.some(file => file.status === 'uploading') && (
                          <Badge variant="secondary" className="bg-primary/10 animate-pulse">
                            Uploading...
                          </Badge>
                        )}
                      </div>
                      <LucideUpload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                      <span>Drag files here or click to upload</span>
                      {fileUploads && fileUploads.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsUploadDialogOpen(true);
                          }}
                        >
                          View Uploads
                        </Button>
                      )}
                    </div>
                    {fileUploads && fileUploads.some(file => file.status === 'uploading') && (
                      <Progress 
                        className="h-1 mt-2" 
                        value={fileUploads.filter(f => f.status === 'uploading')[0]?.progress ?? 0} 
                      />
                    )}
                  </>
                )}
              </div>
              
              <p className="text-sm text-blue-600/70 dark:text-blue-400/70 mt-1">
                Files uploaded to this project
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* AI Interactions card */}
        <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-6">
            <div>
              <div className="flex justify-between items-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                  <LucideBrain className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  {isLoading ? (
                    <LucideLoader className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.aiInteractionsCount.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-base font-medium text-blue-800 dark:text-blue-300">AI Interactions</p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                  Total AI assistant interactions in this project
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Chat button card */}
        <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                  <LucideMessageSquare className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-base font-medium text-blue-800 dark:text-blue-300">Chat with ATLAS</p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                  Interact with your AI assistant
                </p>
              </div>
            </div>
            <Button asChild className="w-full mt-6" variant="outline">
              <Link href={`/projects/${projectId}/chat`}>
                <LucideMessageSquare className="h-4 w-4 mr-2" />
                Open Chat
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
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
              <Button variant="outline" size="sm" onClick={onUploadClick}>
                Browse Files
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Supported file types: .pdf, .docx, .txt, .md, .csv, .json
              </p>
            </div>
            
            {/* Show upload status for all files */}
            {fileUploads && fileUploads.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Uploads</h3>
                  {fileUploads.some(file => file.status === 'complete') && (
                    <p className="text-xs text-green-500">
                      Files uploaded: {fileUploads.filter(f => f.status === 'complete').length}/{fileUploads.length}
                    </p>
                  )}
                </div>
                
                {fileUploads.map(file => (
                  <div key={file.id} className="border rounded-md p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 truncate max-w-[80%]">
                        <LucideFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      {file.status !== 'uploading' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => {
                            if (handleRemoveFile) {
                              handleRemoveFile(file.id);
                            } else {
                              toast.info("File removal is handled by the parent component");
                            }
                          }}
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
                      <span className={`text-xs ${
                        file.status === 'error' 
                          ? 'text-destructive' 
                          : file.status === 'complete'
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                      }`}>
                        {file.status === 'uploading' 
                          ? `Uploading... ${file.progress}%` 
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
          </div>
        </DialogContent>
      </Dialog>
    </>
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