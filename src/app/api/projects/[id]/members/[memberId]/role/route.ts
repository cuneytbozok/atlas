import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for updating member role
const updateRoleSchema = z.object({
  roleId: z.string(),
});

// PATCH - Update a member's role
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
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

    // Check if user is admin or creator of the project
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
        { message: "You don't have permission to update member roles" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validationResult = updateRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { roleId } = validationResult.data;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, description: true }
    });

    if (!role) {
      return NextResponse.json(
        { message: "Role not found" },
        { status: 404 }
      );
    }

    // Check if member exists
    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    if (!member) {
      return NextResponse.json(
        { message: "Member not found" },
        { status: 404 }
      );
    }

    // Check if trying to update the project creator's role
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true }
    });

    if (project && project.createdById === member.user.id) {
      return NextResponse.json(
        { message: "Cannot change the role of the project creator" },
        { status: 400 }
      );
    }

    // Update member's role
    const updatedMember = await prisma.projectMember.update({
      where: { id: memberId },
      data: { roleId },
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
            name: true,
            description: true
          }
        }
      }
    });

    // If the role is PROJECT_MANAGER, ensure the user has this role at the system level
    if (role.name === "PROJECT_MANAGER") {
      const hasProjectManagerRole = await prisma.userRole.findFirst({
        where: {
          userId: member.user.id,
          role: {
            name: "PROJECT_MANAGER"
          }
        }
      });

      if (!hasProjectManagerRole) {
        const projectManagerRole = await prisma.role.findFirst({
          where: { name: "PROJECT_MANAGER" }
        });

        if (projectManagerRole) {
          await prisma.userRole.create({
            data: {
              userId: member.user.id,
              roleId: projectManagerRole.id
            }
          });
        }
      }
    }

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { message: "Failed to update member role" },
      { status: 500 }
    );
  }
} 