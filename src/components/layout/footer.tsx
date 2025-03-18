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
      "border-t bg-background py-3 px-3 sm:py-4 sm:px-6 text-sm text-muted-foreground",
      className
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-col gap-1 sm:gap-2">
          <div className="flex items-center gap-2">
            <Logo variant="icon-only" size="sm" />
            <span className="text-xs sm:text-sm">
              <span className="font-semibold text-foreground">ATLAS</span> - Advanced Team Learning Assistant System
            </span>
          </div>
          <p className="text-xs sm:text-sm">Empowering teams with AI-enhanced collaborative learning</p>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <nav className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
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
      
      <div className="mt-3 sm:mt-4 flex items-center justify-center border-t border-border/40 pt-3 sm:pt-4 text-center">
        <p className="flex items-center gap-1 text-xs">
          © {currentYear} ATLAS. Made with <LucideHeart className="h-3 w-3 text-red-500 fill-red-500" /> by the ATLAS Team
        </p>
      </div>
    </footer>
  );
} 