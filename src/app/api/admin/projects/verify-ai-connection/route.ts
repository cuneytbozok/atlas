import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Define schema for project ID validation
const verifySchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

/**
 * POST - Verify AI resource connection for a project
 * Admin-only endpoint to check if a project's assistant is properly connected to its vector store
 */
const handleVerifyConnection = async (request: Request) => {
  try {
    // Get the request body
    const body = await request.json();
    
    // Validate request data
    const result = verifySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.format() },
        { status: 400 }
      );
    }
    
    const { projectId } = result.data;
    
    // Retrieve the project with its AI resources
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        vectorStore: true,
        assistant: true
      }
    });
    
    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }
    
    // Check if project has both resources
    if (!project.vectorStoreId || !project.assistantId || !project.vectorStore || !project.assistant) {
      return NextResponse.json({
        message: "Project missing AI resources",
        hasVectorStore: !!project.vectorStoreId && !!project.vectorStore,
        hasAssistant: !!project.assistantId && !!project.assistant,
        isConnected: false
      });
    }
    
    // Get OpenAI client
    const client = await AIService.verifyAssistantVectorStoreConnection(
      project.assistant.openaiAssistantId as string,
      project.vectorStore.openaiVectorStoreId as string
    );
    
    return NextResponse.json({
      message: "Connection verified",
      isConnected: true,
      details: client.details
    });
  } catch (error) {
    console.error("Error verifying AI connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        message: `Failed to verify AI connection: ${errorMessage}`,
        isConnected: false 
      },
      { status: 500 }
    );
  }
};

export const POST = withErrorHandling(
  withPermission(handleVerifyConnection, { requiredRole: "ADMIN" })
); 