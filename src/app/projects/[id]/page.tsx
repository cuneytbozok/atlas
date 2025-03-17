"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";
import { LucideCalendar, LucideUsers, LucideFileText } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "completed";
  lastUpdated: string;
  createdAt: string;
  members: string[];
  details: string;
}

type ProjectsData = {
  [key: string]: Project;
};

// This would normally come from an API or database
const projectsData: ProjectsData = {
  "1": {
    id: "1",
    name: "Market Analysis",
    description: "AI-assisted market research and competitor analysis",
    status: "active",
    lastUpdated: "2023-06-15",
    createdAt: "2023-05-10",
    members: ["john.doe@example.com", "jane.smith@example.com"],
    details: "This project aims to analyze market trends and competitor strategies using AI-powered data analysis tools. The insights gathered will inform our product development and marketing strategies."
  },
  "2": {
    id: "2",
    name: "Content Strategy",
    description: "Content planning and creation with AI assistance",
    status: "active",
    lastUpdated: "2023-06-10",
    createdAt: "2023-05-20",
    members: ["jane.smith@example.com", "alex.johnson@example.com"],
    details: "Developing a comprehensive content strategy with AI assistance for content generation, optimization, and performance analysis. This will help us improve our online presence and engagement."
  },
  "3": {
    id: "3",
    name: "Product Roadmap",
    description: "AI-enhanced product planning and feature prioritization",
    status: "completed",
    lastUpdated: "2023-05-28",
    createdAt: "2023-04-15",
    members: ["john.doe@example.com", "alex.johnson@example.com", "sarah.williams@example.com"],
    details: "Creating a data-driven product roadmap with AI assistance to prioritize features based on user needs, market trends, and business goals. This will guide our development efforts for the next 12 months."
  }
};

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const project = projectsData[projectId];

  if (!project) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h1 className="text-h1 mb-2">Project Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The project you are looking for does not exist or has been removed.
            </p>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-h1">{project.name}</h1>
              <div className={`rounded-full px-3 py-1 text-sm ${
                project.status === "active" 
                  ? "bg-success/20 text-success" 
                  : project.status === "completed" 
                    ? "bg-info/20 text-info" 
                    : "bg-muted text-muted-foreground"
              }`}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </div>
            </div>
            <p className="text-muted-foreground mt-1">
              {project.description}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Edit Project</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2">
                <LucideCalendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{project.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{project.lastUpdated}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2">
                <LucideUsers className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {project.members.map((member: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                      {member.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{member}</span>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <LucideUsers className="h-4 w-4 mr-2" />
                  Manage Team
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2">
                <LucideFileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{project.details}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <h2 className="text-h2 mb-4">Ask ATLAS</h2>
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Connect with ATLAS AI to assist with your project</p>
                <Button variant="outline" className="mt-4">Start Conversation</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
} 