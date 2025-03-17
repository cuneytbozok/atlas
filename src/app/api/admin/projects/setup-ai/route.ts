import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Define schema for project ID validation
const setupAISchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

/**
 * POST - Set up AI resources for an existing project
 * Admin-only endpoint to create vector store and assistant for projects that failed setup
 */
const handleSetupAI = async (request: Request) => {
  try {
    // Get the request body
    const body = await request.json();
    
    // Validate request data
    const result = setupAISchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.format() },
        { status: 400 }
      );
    }
    
    const { projectId } = result.data;
    
    // Retrieve the project
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }
    
    // Check if project already has AI resources
    if (project.vectorStoreId && project.assistantId) {
      return NextResponse.json(
        { message: "Project already has AI resources set up", project },
        { status: 200 }
      );
    }
    
    // Set up AI resources
    const updatedProject = await AIService.setupProjectAI(
      projectId,
      project.name,
      project.description
    );
    
    return NextResponse.json({
      message: "AI resources set up successfully",
      project: updatedProject
    });
  } catch (error) {
    console.error("Error setting up AI resources:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: `Failed to set up AI resources: ${errorMessage}` },
      { status: 500 }
    );
  }
};

export const POST = withErrorHandling(
  withPermission(handleSetupAI, { requiredRole: "ADMIN" })
); 