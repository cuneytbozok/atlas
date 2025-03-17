"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideFolder, LucideUsers, LucideLoader, LucideBrain } from "lucide-react";
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
              description="Connect with your AI assistant for enhanced productivity"
              icon={<LucideBrain className="h-8 w-8 text-secondary" />}
              action={
                <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Connect to ATLAS</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <ConnectToAtlasForm onClose={() => setIsConnectDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              }
            />
          </div>
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

  const handleConnect = () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    
    router.push(`/projects/${selectedProjectId}#atlas-ai`);
    toast.success("Connected to ATLAS AI", {
      description: "You can now start your conversation with ATLAS AI"
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Connect to ATLAS</DialogTitle>
        <DialogDescription>
          Select a project to connect with ATLAS AI.
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
                  {projects.map((project) => (
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
