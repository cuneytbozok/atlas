"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ProjectSidebar } from "./project-sidebar";
import { ContextPanel } from "./context-panel";

interface ProjectLayoutProps {
  children: React.ReactNode;
  className?: string;
  contextPanel?: React.ReactNode;
  contextPanelTitle?: string;
}

export function ProjectLayout({ 
  children, 
  className,
  contextPanel,
  contextPanelTitle 
}: ProjectLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <div className="border-r bg-muted/20 w-56 overflow-y-auto">
            <ProjectSidebar />
          </div>
          <main className={cn("flex-1 overflow-auto p-6", className)}>
            {children}
          </main>
          {contextPanel && (
            <ContextPanel title={contextPanelTitle}>
              {contextPanel}
            </ContextPanel>
          )}
        </div>
      </div>
    </div>
  );
} 