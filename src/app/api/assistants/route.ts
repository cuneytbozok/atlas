import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// GET - Fetch all assistants (admin only)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is an admin
    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });
    
    const isAdmin = userRoles.some(userRole => userRole.role.name === "ADMIN");
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Only administrators can view all assistants" },
        { status: 403 }
      );
    }

    // Get all assistants with related projects
    const assistants = await prisma.assistant.findMany({
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(assistants);
  } catch (error) {
    console.error("Error fetching assistants:", error);
    return NextResponse.json(
      { message: "Failed to fetch assistants", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 