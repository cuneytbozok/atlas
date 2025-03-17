import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <MainLayout
      contextPanel={<ProjectContextPanel />}
      contextPanelTitle="Project Details"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1">Projects</h1>
            <p className="text-muted-foreground">
              Manage your AI-assisted projects
            </p>
          </div>
          <Button>New Project</Button>
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
        <Button variant="ghost" size="sm">
          View
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

function ProjectContextPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-h3 mb-2">Project Stats</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted p-3">
            <div className="text-muted-foreground text-body-small">Active</div>
            <div className="text-h2">2</div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-muted-foreground text-body-small">Completed</div>
            <div className="text-h2">1</div>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-h3 mb-2">Recent Activity</h3>
        <div className="space-y-2">
          <div className="rounded-md bg-muted p-3">
            <div className="text-body-small">Project &quot;Market Analysis&quot; updated</div>
            <div className="text-body-small text-muted-foreground">2 hours ago</div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-body-small">New comment on &quot;Content Strategy&quot;</div>
            <div className="text-body-small text-muted-foreground">Yesterday</div>
          </div>
        </div>
      </div>
    </div>
  );
} 