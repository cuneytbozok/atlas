import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// DELETE - Remove a member from the project
export async function DELETE(
  request: Request,
  { params }: { params: { id: string, memberId: string } }
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
    const memberId = params.memberId;

    if (!memberId) {
      return NextResponse.json(
        { message: "Member ID is required" },
        { status: 400 }
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

    // Check if user is admin, creator, or the member being removed
    const userMembership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
        role: {
          name: "ADMIN"
        }
      }
    });

    const isCreator = await prisma.project.findFirst({
      where: {
        id: projectId,
        createdById: user.id
      }
    });

    if (!userMembership && !isCreator) {
      return NextResponse.json(
        { message: "You don't have permission to remove members from this project" },
        { status: 403 }
      );
    }

    // Get the member to remove
    const memberToRemove = await prisma.projectMember.findUnique({
      where: {
        id: memberId,
        projectId
      },
      include: {
        user: {
          select: {
            id: true
          }
        }
      }
    });

    if (!memberToRemove) {
      return NextResponse.json(
        { message: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent removing the project creator if they are the only project manager
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        createdById: true,
        members: {
          include: {
            role: true
          }
        }
      }
    });

    // Only prevent removal if the project creator is the only manager
    const isProjectCreator = project && project.createdById === memberToRemove.user.id;
    const projectManagers = project?.members.filter(m => m.role.name === "PROJECT_MANAGER");
    const isOnlyProjectManager = projectManagers && projectManagers.length === 1 && 
                                projectManagers[0].id === memberId;
    
    if (isProjectCreator && isOnlyProjectManager) {
      return NextResponse.json(
        { message: "Cannot remove the only project manager" },
        { status: 400 }
      );
    }

    // Remove the member
    await prisma.projectMember.delete({
      where: {
        id: memberId
      }
    });

    return NextResponse.json(
      { message: "Member removed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing project member:", error);
    return NextResponse.json(
      { message: "Failed to remove project member" },
      { status: 500 }
    );
  }
} 