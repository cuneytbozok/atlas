import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

// GET - Fetch a single assistant by ID
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
        { message: "Only administrators can view assistant details" },
        { status: 403 }
      );
    }

    const assistantId = params.id;

    // Get the assistant
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
      select: {
        id: true,
        name: true,
        openaiAssistantId: true,
        model: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!assistant) {
      return NextResponse.json(
        { message: "Assistant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(assistant);
  } catch (error) {
    console.error("Error fetching assistant:", error);
    return NextResponse.json(
      { message: "Failed to fetch assistant", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 