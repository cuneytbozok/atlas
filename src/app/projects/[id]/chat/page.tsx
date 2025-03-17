"use client";

import { useState, useEffect } from "react";
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
import { MessagesSquare, Plus, Trash2, Edit, ArrowRight, RefreshCw, ListPlus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  const projectId = params?.id as string;

  // Make sure we have a project ID
  useEffect(() => {
    if (!projectId) {
      router.push('/projects');
      toast.error('Project ID is missing');
    }
  }, [projectId, router]);

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

  // Fetch threads on initial load
  useEffect(() => {
    fetchThreads();
  }, [projectId]);

  // Handle run polling
  useEffect(() => {
    if (currentRun && currentRun.status !== "completed" && currentRun.status !== "failed") {
      const interval = setInterval(() => {
        checkRunStatus();
      }, 1000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [currentRun]);

  // Load messages when a thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

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

  const fetchMessages = async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/threads/${threadId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }
      const data = await response.json();
      setThreadMessages(data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load chat messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const createThread = async () => {
    try {
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
        throw new Error(`Failed to create thread: ${response.statusText}`);
      }

      const thread = await response.json();
      setThreads([thread, ...threads]);
      setSelectedThreadId(thread.id);
      setNewThreadDialogOpen(false);
      setNewThreadTitle("");
      toast.success("New chat thread created");
    } catch (error) {
      console.error("Error creating thread:", error);
      toast.error("Failed to create new chat thread");
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
        throw new Error(`Failed to send message: ${response.statusText}`);
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
      toast.error("Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const checkRunStatus = async () => {
    if (!selectedThreadId || !currentRun) return;

    try {
      const response = await fetch(
        `/api/threads/${selectedThreadId}/runs/${currentRun.id}`
      );

      if (!response.ok) {
        throw new Error(`Failed to check run status: ${response.statusText}`);
      }

      const result = await response.json();
      setCurrentRun({ ...currentRun, status: result.status });

      // If the run completed, add any new messages
      if (result.status === "completed" && result.messages.length > 0) {
        setThreadMessages([...threadMessages, ...result.messages]);
        setCurrentRun(null);
        
        // Also refresh the thread list to update timestamps
        fetchThreads();
      } else if (result.status === "failed") {
        toast.error("Assistant failed to generate a response");
        setCurrentRun(null);
      }
    } catch (error) {
      console.error("Error checking run status:", error);
      // Don't show toast here as this is polled frequently
    }
  };

  const handleThreadSelect = (threadId: string) => {
    if (threadId !== selectedThreadId) {
      setSelectedThreadId(threadId);
      setThreadMessages([]);
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
      <div className="flex-1 flex overflow-hidden">
        {/* Thread List Sidebar */}
        <div className="w-80 flex-shrink-0 bg-muted/30 border-r p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Chats</h2>
            <Button variant="outline" size="sm" onClick={() => setNewThreadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
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
              <h3 className="font-medium mb-1">No chats yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new chat to start conversing with the project assistant
              </p>
              <Button onClick={() => setNewThreadDialogOpen(true)}>
                <ListPlus className="h-4 w-4 mr-2" />
                Create First Chat
              </Button>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          {selectedThreadId ? (
            <>
              {/* Chat Header */}
              <div className="py-3 px-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {threads.find((t) => t.id === selectedThreadId)?.title ||
                    "Chat"}
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

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" id="messages-container">
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
                      Start a conversation by sending a message
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
                Select an existing chat or create a new one to start a conversation
              </p>
              <Button onClick={() => setNewThreadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Chat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Thread Dialog */}
      <Dialog open={newThreadDialogOpen} onOpenChange={setNewThreadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
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
              <Button type="submit">Create</Button>
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