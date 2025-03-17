"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { LucideX, LucideChevronLeft } from "lucide-react";

interface ContextPanelProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
}

export function ContextPanel({ className, children, title = "Context" }: ContextPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  // For mobile view
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <Button
          variant="outline"
          size="sm"
          className="absolute right-4 top-4 z-10"
          onClick={() => setIsOpen(true)}
        >
          <LucideChevronLeft className="h-4 w-4 mr-2" />
          <span>Open</span>
        </Button>
      )}
      
      {/* Desktop view */}
      <div
        className={cn(
          "hidden md:block border-l bg-background transition-all duration-300",
          isOpen ? "w-80" : "w-0 overflow-hidden",
          className
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <LucideX className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
      
      {/* Mobile view */}
      <div className="md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="fixed bottom-4 right-4 z-10"
            >
              <LucideChevronLeft className="h-4 w-4 mr-2" />
              <span>{title}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="py-4">{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
} 