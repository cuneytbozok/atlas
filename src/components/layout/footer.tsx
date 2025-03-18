"use client";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { LucideHeart } from "lucide-react";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className={cn(
      "border-t bg-background py-4 px-6 text-sm text-muted-foreground",
      className
    )}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Logo variant="icon-only" size="sm" />
            <span>
              <span className="font-semibold text-foreground">ATLAS</span> - Advanced Team Learning Assistant System
            </span>
          </div>
          <p>Empowering teams with AI-enhanced collaborative learning</p>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <nav className="flex gap-4">
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center border-t border-border/40 pt-4 text-center">
        <p className="flex items-center gap-1 text-xs">
          © {currentYear} ATLAS. Made with <LucideHeart className="h-3 w-3 text-red-500 fill-red-500" /> by the ATLAS Team
        </p>
      </div>
    </footer>
  );
} 