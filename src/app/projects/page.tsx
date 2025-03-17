"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { LucideUserPlus } from "lucide-react";

export default function ProjectsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1">Projects</h1>
            <p className="text-muted-foreground">
              Manage your AI-assisted projects
            </p>
          </div>
          <CreateProjectModal />
        </div>
        
        <div className="grid gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

function CreateProjectModal() {
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");

  const handleAddMember = () => {
    if (newMember.trim() && !members.includes(newMember.trim())) {
      setMembers([...members, newMember.trim()]);
      setNewMember("");
    }
  };

  const handleRemoveMember = (memberToRemove: string) => {
    setMembers(members.filter(member => member !== memberToRemove));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button id="new-project-button">New Project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new AI-assisted project and add team members.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project-title">Project Title</Label>
            <Input id="project-title" placeholder="Enter project title" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Short Description</Label>
            <Textarea 
              id="project-description" 
              placeholder="Enter a brief description of the project"
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Project Members</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Add member by email or username" 
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMember();
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                onClick={handleAddMember}
              >
                <LucideUserPlus className="h-4 w-4" />
              </Button>
            </div>
            {members.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map((member, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    <span>{member}</span>
                    <button 
                      type="button" 
                      className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => handleRemoveMember(member)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "completed";
  lastUpdated: string;
}

const projects: Project[] = [
  {
    id: "1",
    name: "Market Analysis",
    description: "AI-assisted market research and competitor analysis",
    status: "active",
    lastUpdated: "2023-06-15",
  },
  {
    id: "2",
    name: "Content Strategy",
    description: "Content planning and creation with AI assistance",
    status: "active",
    lastUpdated: "2023-06-10",
  },
  {
    id: "3",
    name: "Product Roadmap",
    description: "AI-enhanced product planning and feature prioritization",
    status: "completed",
    lastUpdated: "2023-05-28",
  },
];

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-h3 mb-1">{project.name}</h3>
          <p className="text-muted-foreground mb-2">{project.description}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            <span className="text-body-small text-muted-foreground">
              Updated {project.lastUpdated}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${project.id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const statusStyles = {
    active: "bg-success/20 text-success border-success/30",
    completed: "bg-info/20 text-info border-info/30",
    archived: "bg-muted text-muted-foreground border-muted-foreground/30",
  };

  return (
    <span
      className={`text-body-small px-2 py-0.5 rounded-full border ${statusStyles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
} 