"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

export default function ProjectChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      return;
    }

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, router]);

  return (
    <>
      <div className="space-y-2 mb-4 md:mb-6">
        {isLoading ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <div>
            <h1 className="text-2xl md:text-display font-bold">{project?.name || 'Project Chat'}</h1>
            <p className="text-muted-foreground text-sm">
              Chat with your project assistant
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)]">
        {children}
      </div>
    </>
  );
} 