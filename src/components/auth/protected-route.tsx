"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredRoles?: string[];
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasAnyRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }

    if (
      !isLoading &&
      isAuthenticated &&
      requiredRole &&
      !hasRole(requiredRole)
    ) {
      router.push("/unauthorized");
    }

    if (
      !isLoading &&
      isAuthenticated &&
      requiredRoles &&
      !hasAnyRole(requiredRoles)
    ) {
      router.push("/unauthorized");
    }
  }, [isAuthenticated, isLoading, router, requiredRole, requiredRoles, hasRole, hasAnyRole]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return null;
  }

  return <>{children}</>;
} 