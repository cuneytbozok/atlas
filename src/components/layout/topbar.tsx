"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  LucideBell, 
  LucideSearch, 
  LucideSun, 
  LucideMoon, 
  LucideUser,
  LucideLogOut,
  LucideSettings
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface TopbarProps {
  className?: string;
}

export function Topbar({ className }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        "flex h-14 items-center justify-between border-b bg-background px-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="h-9 w-64 pl-8"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <LucideBell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <LucideSun className="h-5 w-5" />
            ) : (
              <LucideMoon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Avatar className="h-6 w-6 bg-primary">
                <AvatarFallback className="text-xs font-medium text-primary-foreground">U</AvatarFallback>
              </Avatar>
              <span>User</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LucideUser className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LucideSettings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LucideLogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 