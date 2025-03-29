"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideFolder, LucideUsers, LucideLoader, LucideBrain, LucideMessageSquare } from "lucide-react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

export default function Home() {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [aiInteractionsCount, setAiInteractionsCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch total AI interactions count
  useEffect(() => {
    const fetchAiInteractions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/analytics/ai-interactions');
        
        if (response.ok) {
          const data = await response.json();
          setAiInteractionsCount(data.total);
        } else {
          console.error('Failed to fetch AI interactions count');
          setAiInteractionsCount(0);
        }
      } catch (error) {
        console.error('Error fetching AI interactions:', error);
        setAiInteractionsCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAiInteractions();
  }, []);
  
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-display mb-2">Welcome to ATLAS</h1>
            <p className="text-muted-foreground text-lg">
              Your AI-powered workspace for enhanced productivity
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <DashboardCard
              title="Projects"
              description="Manage your AI-assisted projects and workflows"
              icon={<LucideFolder className="h-8 w-8 text-primary" />}
              action={
                <Button asChild>
                  <Link href="/projects">View Projects</Link>
                </Button>
              }
            />
            <DashboardCard
              title="ATLAS AI"
              description="Chat with your AI assistant about your projects and documents"
              icon={<LucideBrain className="h-8 w-8 text-blue-600" />}
              action={
                <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default">Start Chat</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <ConnectToAtlasForm onClose={() => setIsConnectDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              }
            />
          </div>
          
          {/* AI Interactions Card - Large Icon and Number */}
          <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <div className="p-8">
              <div className="flex justify-between items-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                  <LucideBrain className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  {isLoading ? (
                    <LucideLoader className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                      {aiInteractionsCount?.toLocaleString() || "0"}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-6">
                <p className="text-xl font-medium text-blue-800 dark:text-blue-300">AI Interactions</p>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70 mt-1">
                  Total AI assistant interactions across all projects
                </p>
              </div>
            </div>
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

interface ConnectToAtlasFormProps {
  onClose: () => void;
}

function ConnectToAtlasForm({ onClose }: ConnectToAtlasFormProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/projects');
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        
        const data = await response.json();
        setProjects(data);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError("Failed to fetch projects. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjects();
  }, []);

  // Filter projects based on search query
  const filteredProjects = searchQuery
    ? projects.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : projects;

  const handleConnect = () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    
    // Direct to the chat page instead of the project page with anchor
    router.push(`/projects/${selectedProjectId}/chat`);
    toast.success("Opening ATLAS Chat", {
      description: "You can now chat with your AI assistant about your project"
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Start a Chat</DialogTitle>
        <DialogDescription>
          Select a project to chat with your ATLAS AI assistant.
        </DialogDescription>
      </DialogHeader>
      
      <div className="py-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Projects</Label>
            <input
              id="search"
              type="text"
              placeholder="Search by project name..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="project">Select Project</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <LucideLoader className="h-5 w-5 animate-spin mr-2" />
                <span>Loading projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-2 text-sm text-muted-foreground">
                No projects found. Please create a project first.
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleConnect} 
          disabled={isLoading || !selectedProjectId}
          className="gap-2"
        >
          <LucideBrain className="h-4 w-4" />
          Connect
        </Button>
      </DialogFooter>
    </>
  );
}

interface DashboardCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function DashboardCard({ title, description, icon, action }: DashboardCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        {icon && <div className="mb-2">{icon}</div>}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action && (
        <CardFooter className="pt-4">
          {action}
        </CardFooter>
      )}
    </Card>
  );
}
