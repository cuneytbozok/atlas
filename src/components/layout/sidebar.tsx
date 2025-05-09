"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { 
  LucideHome, 
  LucideFolder, 
  LucideUsers, 
  LucideUser,
  LucideShield,
  LucideBrain,
  LucideSettings,
  LucideBarChart,
  LucideChevronLeft, 
  LucideChevronRight
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  // Check if mobile on initial load and when window resizes
  useEffect(() => {
    // Function to check screen width and set collapsed state
    const checkScreenWidth = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768; // Standard md breakpoint
        setCollapsed(isMobile);
      }
    };

    // Initial check
    checkScreenWidth();

    // Set up event listener for window resize
    window.addEventListener('resize', checkScreenWidth);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('resize', checkScreenWidth);
    };
  }, []);

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
                  href="/insights"
                  icon={<LucideBarChart className="h-5 w-5" />}
                  label="Insights"
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