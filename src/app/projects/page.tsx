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
import { useState, useEffect } from "react";
import { LucideUserPlus, LucideSearch, LucideLoader, LucideX } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
  members: ProjectMember[];
  status?: string;
}

interface ProjectMember {
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`);
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      const data = await response.json();
      setProjects(data);
      setFilteredProjects(data);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError("An error occurred while fetching your projects. Please try again.");
      toast.error("Error", {
        description: "Failed to fetch projects"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    
    // Check if OpenAI API key is configured
    const checkApiKey = async () => {
      try {
        setIsCheckingApiKey(true);
        const response = await fetch("/api/admin/settings/openai-api");
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(data.isSet);
        } else {
          setHasApiKey(false);
        }
      } catch (error) {
        console.error("Error checking API key:", error);
        setHasApiKey(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    };

    checkApiKey();
  }, []);

  // Filter projects when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = projects.filter(project => 
      project.name.toLowerCase().includes(query) || 
      (project.description && project.description.toLowerCase().includes(query))
    );
    
    setFilteredProjects(filtered);
  }, [searchQuery, projects]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The filtering is now handled by the useEffect above
  };

  const handleCreateSuccess = (newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
    setIsDialogOpen(false);
    toast.success("Project Created", {
      description: `${newProject.name} has been created successfully`
    });
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h1">Projects</h1>
              <p className="text-muted-foreground">
                Manage your AI-assisted projects
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button id="new-project-button" disabled={isCheckingApiKey || hasApiKey === false}>
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <CreateProjectForm onSuccess={handleCreateSuccess} onCancel={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
          
          {hasApiKey === false && (
            <Alert variant="default" className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertDescription className="flex justify-between items-center">
                <div>
                  <p className="font-medium">OpenAI API Key Not Configured</p>
                  <p className="text-sm mt-1">
                    An OpenAI API key is required to create projects with AI capabilities. 
                    Without it, projects won't have access to AI assistants or document search.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/settings">Configure API Key</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search projects..."
                  className="pl-8 pr-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <LucideX className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <LucideLoader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No projects found</p>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                disabled={isCheckingApiKey || hasApiKey === false}
              >
                Create Your First Project
              </Button>
              {hasApiKey === false && (
                <p className="text-sm text-muted-foreground mt-2">
                  An OpenAI API key is required to create projects. 
                  <Button variant="link" asChild className="h-auto p-0 ml-1">
                    <Link href="/admin/settings">Configure API Key</Link>
                  </Button>
                </p>
              )}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No projects match your search criteria</p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

interface CreateProjectFormProps {
  onSuccess: (project: Project) => void;
  onCancel: () => void;
}

function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [members, setMembers] = useState<{ email: string }[]>([]);
  const [projectManager, setProjectManager] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [includeCreatorAsTeamMember, setIncludeCreatorAsTeamMember] = useState(false);
  
  // Replace single search query with separate states for each field
  const [managerSearchQuery, setManagerSearchQuery] = useState("");
  const [membersSearchQuery, setMembersSearchQuery] = useState("");
  
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string | null; email: string; image: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"members" | "manager">("members");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = async (query: string, type: "members" | "manager") => {
    // Update the appropriate search query based on type
    if (type === "manager") {
      setManagerSearchQuery(query);
    } else {
      setMembersSearchQuery(query);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search users');
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Error searching users:', err);
      toast.error('Error', {
        description: 'Failed to search users'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = (user: { id: string; email: string; name: string | null }) => {
    if (searchType === "members") {
      if (!members.some(m => m.email === user.email)) {
        setMembers([...members, { email: user.email }]);
      }
      setMembersSearchQuery("");
    } else {
      setProjectManager(user);
      setManagerSearchQuery("");
    }
    setSearchResults([]);
  };

  const handleRemoveMember = (memberToRemove: string) => {
    setMembers(members.filter(member => member.email !== memberToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        throw new Error("Project name is required");
      }

      if (!formData.description.trim()) {
        throw new Error("Project description is required");
      }

      if (!projectManager) {
        throw new Error("Project manager is required");
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          members: members.length > 0 ? members : undefined,
          projectManagerId: projectManager.id,
          creatorShouldBeTeamMember: includeCreatorAsTeamMember
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create project");
      }

      onSuccess(data);
    } catch (err) {
      console.error("Error creating project:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create project";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogDescription>
          Create a new AI-assisted project and add team members.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="name">Project Name</Label>
          <Input 
            id="name" 
            name="name"
            placeholder="Enter project name" 
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
          <Textarea 
            id="description" 
            name="description"
            placeholder="Enter a brief description of the project"
            className="resize-none"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>
        
        {/* Creator as Team Member Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="creatorAsMember" 
            checked={includeCreatorAsTeamMember}
            onCheckedChange={(checked) => 
              setIncludeCreatorAsTeamMember(checked === true)
            }
          />
          <div className="flex items-center gap-1">
            <Label htmlFor="creatorAsMember" className="cursor-pointer">
              Include me as a team member
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p>When selected, you'll be added as a team member in addition to your role as the creator of the project. This gives you access to the project even if you're not the Project Manager.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        {/* Project Manager Selection */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-1">
            Project Manager <span className="text-destructive">*</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground ml-1 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p>Project Managers have permissions to manage the project, including adding team members, uploading files, and configuring project settings.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="relative">
            <Input 
              placeholder="Search for a project manager" 
              value={managerSearchQuery}
              onChange={(e) => handleSearch(e.target.value, "manager")}
              onFocus={() => setSearchType("manager")}
              className="pr-8"
            />
            {isSearching && searchType === "manager" && (
              <div className="absolute right-2 top-2">
                <LucideLoader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {searchType === "manager" && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-black ring-opacity-5">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleAddMember(user)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{user.name || 'No name'}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {projectManager && (
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm">
                <span>{projectManager.name || projectManager.email} (Project Manager)</span>
                <button 
                  type="button" 
                  className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => setProjectManager(null)}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid gap-2">
          <Label className="flex items-center gap-1">
            Team Members
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground ml-1 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p>Team Members have access to use project resources, participate in chats, and view documents but have limited management capabilities.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="relative">
            <Input 
              placeholder="Search users by name or email" 
              value={membersSearchQuery}
              onChange={(e) => handleSearch(e.target.value, "members")}
              onFocus={() => setSearchType("members")}
              className="pr-8"
            />
            {isSearching && searchType === "members" && (
              <div className="absolute right-2 top-2">
                <LucideLoader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {searchType === "members" && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-black ring-opacity-5">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleAddMember(user)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{user.name || 'No name'}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {members.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {members.map((member, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                >
                  <span>{member.email}</span>
                  <button 
                    type="button" 
                    className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => handleRemoveMember(member.email)}
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Project"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  const formattedDate = new Date(project.updatedAt).toLocaleDateString();
  
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-h3 mb-1">{project.name}</h3>
          <p className="text-muted-foreground mb-2">{project.description || "No description"}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status || "active"} />
            <span className="text-body-small text-muted-foreground">
              Updated {formattedDate}
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

function StatusBadge({ status }: { status: string }) {
  const statusStyles = {
    active: "bg-success/20 text-success border-success/30",
    completed: "bg-info/20 text-info border-info/30",
    archived: "bg-muted text-muted-foreground border-muted-foreground/30",
  };

  const style = statusStyles[status as keyof typeof statusStyles] || statusStyles.active;

  return (
    <span
      className={`text-body-small px-2 py-0.5 rounded-full border ${style}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
} 