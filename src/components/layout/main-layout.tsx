"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ContextPanel } from "./context-panel";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  contextPanel?: React.ReactNode;
  contextPanelTitle?: string;
}

export function MainLayout({ 
  children, 
  className,
  contextPanel,
  contextPanelTitle 
}: MainLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
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