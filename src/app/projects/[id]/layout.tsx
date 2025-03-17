"use client";

import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useEffect, useState, createContext, useContext } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";
import { LucideLoader } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  [key: string]: any; // Allow any additional properties from the API
}

// Create a context for project data
interface ProjectContextType {
  project: Project | null;
  isLoading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  project: null,
  isLoading: true,
  error: null,
  refreshProject: async () => {}
});

// Hook to use project context
export const useProject = () => useContext(ProjectContext);

export default function ProjectMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchProject = async () => {
    if (!projectId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/projects/${projectId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch project details');
      }
      
      const data = await response.json();
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Failed to load project. It may not exist or you do not have access.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      router.push('/projects');
      return;
    }

    fetchProject();
  }, [projectId, router]);

  // Handle error state
  if (error) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h1 className="text-h1 mb-2">Project Not Found</h1>
                <p className="text-muted-foreground mb-4">
                  {error}
                </p>
                <Button asChild>
                  <Link href="/projects">Back to Projects</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Create context value
  const contextValue: ProjectContextType = {
    project,
    isLoading,
    error,
    refreshProject: fetchProject
  };

  return (
    <ProtectedRoute>
      <ProjectContext.Provider value={contextValue}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <div className="flex flex-1 overflow-hidden">
              <div className="border-r bg-muted/20 w-56 overflow-y-auto">
                <ProjectSidebar />
              </div>
              <main className="flex-1 overflow-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </div>
      </ProjectContext.Provider>
    </ProtectedRoute>
  );
} 