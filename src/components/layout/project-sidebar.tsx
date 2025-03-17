"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  LucideHome, 
  LucideUsers, 
  LucideSettings, 
  LucideFolder,
  LucideFileText,
  LucideMessageSquare
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

interface ProjectSidebarProps {
  className?: string;
  collapsed?: boolean;
}

export function ProjectSidebar({ className, collapsed = false }: ProjectSidebarProps) {
  const params = useParams();
  const projectId = params?.id as string;
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  return (
    <div className={cn("py-4", className)}>
      <h2 className={cn(
        "px-4 text-lg font-semibold mb-2",
        collapsed && "sr-only"
      )}>
        Project Navigation
      </h2>
      <nav className="grid gap-1 px-2">
        <TooltipProvider delayDuration={0}>
          <NavItem
            href={`/projects/${projectId}`}
            icon={<LucideHome className="h-5 w-5" />}
            label="Overview"
            collapsed={collapsed}
          />
          <NavItem
            href={`/projects/${projectId}/chat`}
            icon={<LucideMessageSquare className="h-5 w-5" />}
            label="Chat"
            collapsed={collapsed}
          />
          <NavItem
            href={`/projects/${projectId}/documents`}
            icon={<LucideFileText className="h-5 w-5" />}
            label="Documents"
            collapsed={collapsed}
          />
          {isAdmin && (
            <NavItem
              href={`/projects/${projectId}/settings`}
              icon={<LucideSettings className="h-5 w-5" />}
              label="Settings"
              collapsed={collapsed}
            />
          )}
        </TooltipProvider>
      </nav>
    </div>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

function NavItem({ href, icon, label, collapsed }: NavItemProps) {
  const params = useParams();
  const isActive = href === `/projects/${params?.id}` || 
                  (href !== `/projects/${params?.id}` && 
                   href.startsWith(`/projects/${params?.id}/`) && 
                   href.endsWith(String(params?.path || '')));
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant={isActive ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "justify-start h-10",
            collapsed && "justify-center px-2"
          )}
        >
          <Link href={href}>
            <span className="mr-2">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </Link>
        </Button>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right">
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  );
} 