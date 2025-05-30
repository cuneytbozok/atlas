"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessagesSquare, Plus, Trash2, Edit, ArrowRight, RefreshCw, ListPlus, X, ArrowLeft, Menu, Brain, Loader } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Thread {
  id: string;
  title: string;
  openaiThreadId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  openaiMessageId: string;
  createdAt: string;
}

interface Run {
  id: string;
  status: string;
}

export default function ProjectChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const projectId = params?.id as string;

  // Project state
  const [project, setProject] = useState<{id: string, name: string, status: string, assistantId: string | null, vectorStoreId: string | null} | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // Thread state
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newThreadDialogOpen, setNewThreadDialogOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [editThreadDialogOpen, setEditThreadDialogOpen] = useState(false);
  const [editThreadTitle, setEditThreadTitle] = useState("");
  const [isEditingThread, setIsEditingThread] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  // Message state
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Add state for mobile sidebar toggle
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Check if the project is archived or completed
  const isProjectDisabled = project?.status === 'archived' || project?.status === 'completed';

  // Make sure we have a project ID
  useEffect(() => {
    if (!projectId) {
      router.push('/projects');
      toast.error('Project ID is missing');
    }
  }, [projectId, router]);

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoadingProject(true);
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch project details');
        }
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
        toast.error('Failed to load project details');
      } finally {
        setIsLoadingProject(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  // Define fetchThreads function before it's used in useEffect
  const fetchThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/threads`);
      if (!response.ok) {
        throw new Error(`Failed to fetch threads: ${response.statusText}`);
      }
      const data = await response.json();
      setThreads(data);
      
      // Select the first thread if none is selected
      if (data.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast.error("Failed to load chat threads");
    } finally {
      setIsLoadingThreads(false);
    }
  };

  // Define other functions that might be used in useEffect
  const fetchMessages = async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/threads/${threadId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }
      const data = await response.json();
      setThreadMessages(data.messages || []);
      
      // Ensure currentRun is cleared after loading messages
      // This helps reset the chat input state
      setCurrentRun(null);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load chat messages");
      // Also ensure currentRun is cleared on error
      setCurrentRun(null);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Check if mobile on initial load and when window resizes
  useEffect(() => {
    const checkScreenWidth = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768; // Standard md breakpoint
        setShowSidebar(!isMobile);
      }
    };

    // Initial check
    checkScreenWidth();

    // Set up event listener for window resize
    window.addEventListener('resize', checkScreenWidth);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('resize', checkScreenWidth);
    };
  }, []);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current && threadMessages.length > 0) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [threadMessages]);

  // Fetch threads on initial load
  useEffect(() => {
    fetchThreads();
  }, [projectId]);

  const checkRunStatus = async () => {
    if (!currentRun || !selectedThreadId) return;

    try {
      const response = await fetch(`/api/threads/${selectedThreadId}/runs/${currentRun.id}`);
      if (!response.ok) {
        throw new Error(`Failed to check run status: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Run status: ${data.status}`);
      
      // Update the run status
      setCurrentRun({
        ...currentRun,
        status: data.status
      });
      
      // If completed, fetch the new messages
      if (data.status === "completed") {
        fetchMessages(selectedThreadId);
        // Reset currentRun state after completion
        setCurrentRun(null);
      } else if (data.status === "failed" || data.status === "cancelled") {
        toast.error("Assistant failed to respond", {
          description: "Please try again or contact support if the issue persists."
        });
        // Reset currentRun state on failure or cancellation
        setCurrentRun(null);
      }
    } catch (error) {
      console.error("Error checking run status:", error);
      setCurrentRun(null);
    }
  };

  // Handle run polling
  useEffect(() => {
    if (currentRun && currentRun.status !== "completed" && currentRun.status !== "failed" && currentRun.status !== "cancelled") {
      // Clear any existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      console.log(`Setting up polling for run ${currentRun.id} with status ${currentRun.status}`);
      
      // Set up polling with an increasing backoff
      let attemptCount = 0;
      const maxAttempts = 30; // Limit to prevent infinite polling
      
      const interval = setInterval(() => {
        attemptCount++;
        console.log(`Polling attempt ${attemptCount} for run ${currentRun.id}`);
        
        if (attemptCount > maxAttempts) {
          console.log(`Reached max polling attempts (${maxAttempts}), stopping`);
          clearInterval(interval);
          setPollingInterval(null);
          setCurrentRun(null);
          toast.error("Assistant response timed out");
          return;
        }
        
        checkRunStatus();
      }, 2000); // Poll every 2 seconds
      
      setPollingInterval(interval);
      return () => {
        console.log(`Cleaning up polling interval for run ${currentRun.id}`);
        clearInterval(interval);
      };
    } else if (currentRun && (currentRun.status === "completed" || currentRun.status === "failed" || currentRun.status === "cancelled")) {
      // If run is completed, failed, or cancelled, clean up and reset states
      console.log(`Run ${currentRun?.id} status is ${currentRun?.status}, clearing polling interval and resetting state`);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      // We'll let the checkRunStatus function handle setting currentRun to null
    } else if (pollingInterval) {
      console.log(`Run ${currentRun?.id} status is ${currentRun?.status}, clearing polling interval`);
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [currentRun?.id, currentRun?.status]);

  // Load messages when a thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

  // Check if the project has AI resources
  const hasAiResources = project && project.assistantId && project.vectorStoreId;

  // Render error state if the project is missing AI resources
  if (!isLoadingProject && !hasAiResources) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Brain className="h-16 w-16 mb-4 text-muted-foreground" />
        <h3 className="text-xl font-medium mb-2">AI Resources Not Available</h3>
        <p className="text-muted-foreground mb-2 max-w-md">
          This project doesn't have the required AI resources (assistant and/or vector store).
        </p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          This likely happened because the OpenAI API key was not configured when the project was created.
        </p>
        
        <div className="flex gap-3">
          <Button asChild variant="default">
            <Link href={`/projects/${projectId}#atlas-ai`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Link>
          </Button>
          
          {hasRole('ADMIN') && (
            <Button asChild variant="outline">
              <Link href="/admin/settings">
                Configure API Key
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const createThread = async () => {
    try {
      // Check if project is archived or completed
      if (isProjectDisabled) {
        toast.error("Cannot create new threads for archived and completed projects");
        setNewThreadDialogOpen(false);
        return;
      }

      const response = await fetch(`/api/projects/${projectId}/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newThreadTitle || `New Thread ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to create thread: ${response.statusText}`);
      }

      const thread = await response.json();
      setThreads([thread, ...threads]);
      setSelectedThreadId(thread.id);
      setNewThreadDialogOpen(false);
      setNewThreadTitle("");
      toast.success("New chat thread created");
    } catch (error) {
      console.error("Error creating thread:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create new chat thread");
    }
  };

  const updateThread = async () => {
    if (!selectedThreadId) return;
    
    setIsEditingThread(true);
    try {
      const response = await fetch(`/api/threads/${selectedThreadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editThreadTitle,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update thread: ${response.statusText}`);
      }

      const updatedThread = await response.json();
      setThreads(
        threads.map((t) => (t.id === selectedThreadId ? updatedThread : t))
      );
      setEditThreadDialogOpen(false);
      toast.success("Thread renamed successfully");
    } catch (error) {
      console.error("Error updating thread:", error);
      toast.error("Failed to rename thread");
    } finally {
      setIsEditingThread(false);
    }
  };

  const deleteThread = async () => {
    if (!threadToDelete) return;

    try {
      const response = await fetch(`/api/threads/${threadToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete thread: ${response.statusText}`);
      }

      // Remove thread from state
      const newThreads = threads.filter((t) => t.id !== threadToDelete);
      setThreads(newThreads);
      
      // If deleted the selected thread, select another one
      if (selectedThreadId === threadToDelete) {
        setSelectedThreadId(newThreads.length > 0 ? newThreads[0].id : null);
        setThreadMessages([]);
      }
      
      setDeleteConfirmOpen(false);
      setThreadToDelete(null);
      toast.success("Thread deleted successfully");
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast.error("Failed to delete thread");
    }
  };

  const sendMessage = async () => {
    if (!selectedThreadId || !newMessage.trim()) return;

    // Check if project is archived or completed
    if (isProjectDisabled) {
      toast.error("Cannot send messages in archived or completed projects");
      return;
    }

    setIsSendingMessage(true);
    try {
      const response = await fetch(`/api/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to send message: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Add the user message to the UI immediately
      const userMessage = result.message;
      setThreadMessages([...threadMessages, userMessage]);
      
      // Set the run to track the assistant's response
      setCurrentRun(result.run);
      
      // Clear the input
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
    
    // Hide sidebar on mobile after thread selection
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const openEditDialog = (thread: Thread) => {
    setEditThreadTitle(thread.title);
    setEditThreadDialogOpen(true);
  };

  const confirmDeleteThread = (threadId: string) => {
    setThreadToDelete(threadId);
    setDeleteConfirmOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Thread List Sidebar */}
        <div 
          className={cn(
            "md:w-80 w-full absolute md:relative z-20 flex-shrink-0 bg-background border-r p-4 flex flex-col h-full transition-transform duration-300 ease-in-out",
            showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          {/* Sidebar Header */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Chats</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8" 
                onClick={() => setShowSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {isProjectDisabled && (
              <div className="p-2 bg-yellow-100/50 border border-yellow-200 rounded-md text-sm text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-500">
                This project is {project?.status}. Chat functionality is limited to viewing existing conversations.
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                asChild 
                className="md:hidden"
              >
                <Link href={`/projects/${projectId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setNewThreadDialogOpen(true)}
                disabled={isProjectDisabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
            
            <div className="hidden md:block">
              <Button variant="ghost" size="sm" asChild className="pl-0 h-7">
                <Link href={`/projects/${projectId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Link>
              </Button>
            </div>
          </div>
          
          {isLoadingThreads ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : threads.length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-1">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-3 rounded-md cursor-pointer transition flex items-center justify-between group ${
                    selectedThreadId === thread.id
                      ? "bg-primary/10 hover:bg-primary/15"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleThreadSelect(thread.id)}
                >
                  <div className="flex items-center overflow-hidden">
                    <MessagesSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="truncate">
                      <div className="font-medium truncate">{thread.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(thread.updatedAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition flex space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(thread);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteThread(thread.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessagesSquare className="h-10 w-10 mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No chats yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isProjectDisabled 
                  ? `This project is ${project?.status}. You cannot create new chats.` 
                  : "Create a new chat to start conversing with the project assistant"}
              </p>
              {!isProjectDisabled && (
                <Button onClick={() => setNewThreadDialogOpen(true)}>
                  <ListPlus className="h-4 w-4 mr-2" />
                  Create First Chat
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          {/* Mobile sidebar toggle */}
          <div className="md:hidden flex items-center pl-4 py-3 border-b">
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-2" 
              onClick={() => setShowSidebar(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold truncate">
              {threads.find((t) => t.id === selectedThreadId)?.title || "Chat"}
            </h2>
          </div>

          {selectedThreadId ? (
            <>
              {/* Chat Header - only on desktop */}
              <div className="py-3 px-6 border-b hidden md:flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {threads.find((t) => t.id === selectedThreadId)?.title || "Chat"}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedThreadId) {
                        fetchMessages(selectedThreadId);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Project Status Banner */}
              {isProjectDisabled && (
                <div className="px-6 py-2 bg-yellow-100 border-b border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-800/50 dark:text-yellow-500 text-sm">
                  <strong>Notice:</strong> This project is {project?.status}. You can view messages but cannot send new ones.
                </div>
              )}

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4" 
                id="messages-container"
                ref={messagesContainerRef}
              >
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-3/4" />
                    <Skeleton className="h-16 w-3/4 ml-auto" />
                    <Skeleton className="h-16 w-3/4" />
                  </div>
                ) : threadMessages.length > 0 ? (
                  threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {formatDate(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessagesSquare className="h-10 w-10 mb-4 text-muted-foreground" />
                    <h3 className="font-medium mb-2">No messages yet</h3>
                    <p className="text-sm text-muted-foreground">
                      {isProjectDisabled 
                        ? "This thread doesn't have any messages."
                        : "Start a conversation by sending a message"}
                    </p>
                  </div>
                )}
                
                {/* Typing indicator when assistant is generating a response */}
                {currentRun && currentRun.status !== "completed" && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg bg-muted">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <div className="h-2 w-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                {isProjectDisabled ? (
                  <div className="p-3 bg-muted rounded-md text-muted-foreground text-center">
                    This project is {project?.status}. Creating new messages is disabled.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center space-x-2"
                  >
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isSendingMessage || !!currentRun}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || isSendingMessage || !!currentRun}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </form>
                )}
                {currentRun && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Assistant is {currentRun.status}...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessagesSquare className="h-16 w-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No chat selected</h3>
              <p className="text-muted-foreground mb-6">
                {isProjectDisabled
                  ? `This project is ${project?.status}. You can only view existing chats.`
                  : "Select an existing chat or create a new one to start a conversation"}
              </p>
              {!isProjectDisabled && (
                <Button onClick={() => setNewThreadDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Chat
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Thread Dialog */}
      <Dialog open={newThreadDialogOpen} onOpenChange={setNewThreadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
            {isProjectDisabled && (
              <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
                Chat creation is disabled for archived and completed projects.
              </div>
            )}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createThread();
            }}
          >
            <div className="py-4">
              <Input
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                placeholder="Chat Title (optional)"
                className="w-full"
                disabled={isProjectDisabled}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewThreadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProjectDisabled}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Thread Dialog */}
      <Dialog open={editThreadDialogOpen} onOpenChange={setEditThreadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateThread();
            }}
          >
            <div className="py-4">
              <Input
                value={editThreadTitle}
                onChange={(e) => setEditThreadTitle(e.target.value)}
                placeholder="Chat Title"
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditThreadDialogOpen(false)}
                disabled={isEditingThread}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!editThreadTitle.trim() || isEditingThread}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setThreadToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={deleteThread}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 