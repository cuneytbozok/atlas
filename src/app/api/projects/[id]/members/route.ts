import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for adding members
const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  roleId: z.string().optional(),
});

// GET - List all members of a project
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

    const isCreator = await prisma.project.findFirst({
      where: {
        id: projectId,
        createdById: user.id
      }
    });

    if (!userMembership && !isCreator) {
      return NextResponse.json(
        { message: "You don't have access to this project" },
        { status: 403 }
      );
    }

    // Get all members of the project
    const members = await prisma.projectMember.findMany({
      where: {
        projectId
      },
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
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json(
      { message: "Failed to fetch project members" },
      { status: 500 }
    );
  }
}

// POST - Add a new member to the project
export async function POST(
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
        { message: "You don't have permission to add members to this project" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validationResult = addMemberSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, roleId } = validationResult.data;

    // Get default member role if roleId not provided
    let memberRoleId = roleId;
    if (!memberRoleId) {
      const memberRole = await prisma.role.findFirst({
        where: { name: "USER" },
        select: { id: true }
      });

      if (!memberRole) {
        return NextResponse.json(
          { message: "Default member role not found" },
          { status: 500 }
        );
      }

      memberRoleId = memberRole.id;
    }

    // Find the user to add
    const userToAdd = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (!userToAdd) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userToAdd.id
        }
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { message: "User is already a member of this project" },
        { status: 400 }
      );
    }

    // Add user to project
    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: userToAdd.id,
        roleId: memberRoleId
      },
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
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Error adding project member:", error);
    return NextResponse.json(
      { message: "Failed to add project member" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a member from the project
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
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

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

    // Prevent removing the project creator
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true }
    });

    if (project && project.createdById === memberToRemove.user.id) {
      return NextResponse.json(
        { message: "Cannot remove the project creator" },
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