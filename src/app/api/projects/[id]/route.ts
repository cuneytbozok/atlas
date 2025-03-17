import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// GET - Fetch a single project by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.id;

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

    // Check if user has access to the project
    const userMembership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id
      }
    });

    // Get the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    // Check if user is a member of the project or the creator
    if (!userMembership && project.createdById !== user.id) {
      return NextResponse.json(
        { message: "You don't have access to this project" },
        { status: 403 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { message: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH - Update a project
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.id;
    
    try {
      const body = await request.json();
      console.log("Project update request body:", body);
      const { name, description, status } = body;

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

      // Get the project first
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { 
          id: true,
          createdById: true 
        }
      });

      if (!project) {
        return NextResponse.json(
          { message: "Project not found" },
          { status: 404 }
        );
      }

      // Check if user is the creator (simplest check)
      const isCreator = project.createdById === user.id;
      console.log("Creator check:", { userId: user.id, createdById: project.createdById, isCreator });

      // If not creator, check if user is an admin
      let hasPermission = isCreator;
      
      if (!hasPermission) {
        // Check if user is admin of the project
        const userMembership = await prisma.projectMember.findFirst({
          where: {
            projectId,
            userId: user.id,
          },
          include: {
            role: true
          }
        });

        console.log("User membership:", userMembership);
        
        if (userMembership && userMembership.role) {
          // Check if role name is admin (case insensitive)
          const roleName = userMembership.role.name.toUpperCase();
          hasPermission = roleName === "ADMIN";
          console.log("Role check:", { roleName, hasPermission });
        }
      }

      if (!hasPermission) {
        return NextResponse.json(
          { message: "You don't have permission to update this project" },
          { status: 403 }
        );
      }

      // Validate status if provided
      if (status && !["active", "completed", "archived"].includes(status)) {
        return NextResponse.json(
          { message: "Invalid status value" },
          { status: 400 }
        );
      }

      console.log("Updating project with data:", {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
      });

      // Update the project
      try {
        const updatedProject = await prisma.project.update({
          where: { id: projectId },
          data: {
            name: name !== undefined ? name : undefined,
            description: description !== undefined ? description : undefined,
            status: status !== undefined ? status : undefined,
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true
                  }
                },
                role: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        });

        return NextResponse.json(updatedProject);
      } catch (prismaError) {
        console.error("Prisma error updating project:", prismaError);
        return NextResponse.json(
          { message: "Database error updating project", error: prismaError instanceof Error ? prismaError.message : "Unknown error" },
          { status: 500 }
        );
      }
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { message: "Invalid request body", error: parseError instanceof Error ? parseError.message : "Unknown error" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating project:", error);
    // Ensure we always return a JSON response even for unexpected errors
    return NextResponse.json(
      { message: "Failed to update project", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a project
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.id;

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

    // Check if user is the creator of the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true }
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    if (project.createdById !== user.id) {
      return NextResponse.json(
        { message: "Only the project creator can delete the project" },
        { status: 403 }
      );
    }

    // Delete the project
    await prisma.project.delete({
      where: { id: projectId }
    });

    return NextResponse.json(
      { message: "Project deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { message: "Failed to delete project" },
      { status: 500 }
    );
  }
} 