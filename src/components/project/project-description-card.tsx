"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideFileText, LucideUsers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectManager {
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

interface ProjectDescriptionCardProps {
  description: string | null;
  projectManager: ProjectManager | null;
}

// Helper function to get initials from name or email
const getInitials = (name: string | null, email: string): string => {
  if (name) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

export function ProjectDescriptionCard({ description, projectManager }: ProjectDescriptionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="mb-2">
          <LucideFileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <CardTitle className="text-base">Project Description</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            {description ? (
              <p className="text-sm">{description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description provided</p>
            )}
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <LucideUsers className="h-4 w-4 text-muted-foreground" />
              Project Manager
            </h3>
            
            {projectManager ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {projectManager.user.image && (
                    <AvatarImage src={projectManager.user.image} alt={projectManager.user.name || ''} />
                  )}
                  <AvatarFallback>
                    {getInitials(projectManager.user.name, projectManager.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{projectManager.user.name || projectManager.user.email}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">PM</Badge>
                  </div>
                  {projectManager.user.name && (
                    <span className="text-xs text-muted-foreground">{projectManager.user.email}</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No project manager assigned</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 