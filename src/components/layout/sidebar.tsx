"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { 
  LucideHome, 
  LucideUsers, 
  LucideSettings, 
  LucideFolder, 
  LucideChevronLeft, 
  LucideChevronRight,
  LucideUser,
  LucideShield,
  LucideBrain
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/ui/logo";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-background shadow-sm transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex h-14 items-center border-b px-3">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          {collapsed ? (
            <Logo variant="icon-only" size="md" />
          ) : (
            <Logo variant="default" size="md" />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          <TooltipProvider delayDuration={0}>
            <NavItem
              href="/"
              icon={<LucideHome className="h-5 w-5" />}
              label="Dashboard"
              collapsed={collapsed}
            />
            <NavItem
              href="/projects"
              icon={<LucideFolder className="h-5 w-5" />}
              label="Projects"
              collapsed={collapsed}
            />
            
            {isAdmin && (
              <>
                <Separator className="my-2" />
                <NavItem
                  href="/admin/users"
                  icon={<LucideUsers className="h-5 w-5" />}
                  label="User Management"
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/assistants"
                  icon={<LucideBrain className="h-5 w-5" />}
                  label="Assistants"
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/settings"
                  icon={<LucideSettings className="h-5 w-5" />}
                  label="App Settings"
                  collapsed={collapsed}
                />
              </>
            )}
            
            <Separator className="my-2" />
            
            <NavItem
              href="/profile"
              icon={<LucideUser className="h-5 w-5" />}
              label="Profile"
              collapsed={collapsed}
            />
          </TooltipProvider>
        </nav>
      </div>
      <div className="mt-auto border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <LucideChevronRight className="h-5 w-5" />
          ) : (
            <LucideChevronLeft className="h-5 w-5" />
          )}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
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
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {icon}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
} 