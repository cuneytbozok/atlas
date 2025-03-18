"use client";

import { useAuth } from "@/hooks/use-auth";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, hasRole, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading) {
      const adminStatus = hasRole("ADMIN");
      setIsAdmin(adminStatus);
      
      if (!adminStatus) {
        redirect("/unauthorized");
      }
    }
  }, [isLoading, hasRole]);

  if (isLoading || isAdmin === null) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
} 