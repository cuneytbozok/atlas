import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// DELETE - Remove a role from a user
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

    // Check if user is an admin
    if (!session.user.roles.includes("ADMIN")) {
      return NextResponse.json(
        { message: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const userRoleId = params.id;

    // Check if user role exists
    const userRole = await prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: {
        role: true,
        user: true
      }
    });

    if (!userRole) {
      return NextResponse.json(
        { message: "User role not found" },
        { status: 404 }
      );
    }

    // Don't allow removing the last ADMIN role
    if (userRole.role.name === "ADMIN") {
      // Count how many users have the ADMIN role
      const adminCount = await prisma.userRole.count({
        where: {
          role: {
            name: "ADMIN"
          }
        }
      });

      // If this is the last admin, don't allow removal
      if (adminCount <= 1) {
        return NextResponse.json(
          { message: "Cannot remove the last admin role" },
          { status: 400 }
        );
      }
    }

    // Remove role from user
    await prisma.userRole.delete({
      where: { id: userRoleId }
    });

    return NextResponse.json({ message: "Role removed successfully" });
  } catch (error) {
    console.error("Error removing role from user:", error);
    return NextResponse.json(
      { message: "Failed to remove role from user" },
      { status: 500 }
    );
  }
} 