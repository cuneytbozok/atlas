"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const user = session?.user;

  const login = async (email: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during login.",
      };
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/auth/login");
  };

  const hasRole = (role: string) => {
    return user?.roles?.includes(role) || false;
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => hasRole(role));
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
    hasAnyRole,
  };
} 