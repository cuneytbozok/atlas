import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// Define the system roles and their display names
const SYSTEM_ROLES = {
  'ADMIN': 'Administrator',
  'PROJECT_MANAGER': 'Project Manager',
  'USER': 'Team Member'
};

// Define the Role interface
interface Role {
  id: string;
  name: string;
  description: string | null;
  displayName?: string;
  rolePermissions?: any;
  [key: string]: any;
}

// GET - List all available roles
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is an admin
    const isAdmin = session.user.roles.includes("ADMIN");
    
    // Get all roles - include permissions only for admins
    let roles = await prisma.role.findMany({
      include: {
        rolePermissions: isAdmin ? {
          include: {
            permission: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        } : undefined
      },
      orderBy: {
        name: 'asc'
      }
    });

    // For project context, only return the system roles
    const { searchParams } = new URL(request.url);
    const context = searchParams.get("context");
    
    if (context === "project") {
      // Only include the system roles for project context
      const systemRoleNames = Object.keys(SYSTEM_ROLES);
      roles = roles.filter((role: Role) => systemRoleNames.includes(role.name));
    }
    
    // Add display names to all roles
    roles = roles.map((role: Role) => ({
      ...role,
      displayName: SYSTEM_ROLES[role.name as keyof typeof SYSTEM_ROLES] || role.name
    }));

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { message: "Failed to fetch roles" },
      { status: 500 }
    );
  }
} 