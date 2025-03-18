import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai-service";
import { z } from "zod";

// Schema for updating assistant
const updateAssistantSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectDescription: z.string().nullable().optional(),
});

// PUT - Update the assistant for a project
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const startTime = Date.now();
    
    // Extract projectId from params and ensure it's a string
    const { id: projectId } = params;
    
    console.log(`[Assistant Update] Starting update process for project ${projectId}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log(`[Assistant Update] Unauthorized - No valid session found`);
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log(`[Assistant Update] Session user: ${session.user.email}`);
    // No need to reassign projectId again, we already extracted it above

    // Find the user and check if they are an admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      console.log(`[Assistant Update] User not found: ${session.user.email}`);
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is an admin using the userRole relation
    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });
    const isAdmin = userRoles.some(userRole => userRole.role.name === "ADMIN");
    
    console.log(`[Assistant Update] User ${user.id} has admin role: ${isAdmin}`);
    
    // Get the project with assistant info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: {
            userId: user.id,
            role: {
              name: "PROJECT_MANAGER"
            }
          }
        },
        assistant: {
          select: {
            id: true,
            name: true,
            openaiAssistantId: true
          }
        }
      }
    });

    if (!project) {
      console.log(`[Assistant Update] Project not found: ${projectId}`);
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    console.log(`[Assistant Update] Found project: ${project.id} | ${project.name}`);
    if (project.assistant) {
      console.log(`[Assistant Update] Assistant found: ${project.assistant.id} | OpenAI ID: ${project.assistant.openaiAssistantId}`);
    } else {
      console.log(`[Assistant Update] No assistant found for project`);
    }

    const isCreator = project.createdById === user.id;
    const isProjectManager = project.members.length > 0;

    console.log(`[Assistant Update] User permissions: isAdmin=${isAdmin}, isCreator=${isCreator}, isProjectManager=${isProjectManager}`);

    // Only allow admins, creators, and project managers to update the assistant
    if (!isAdmin && !isCreator && !isProjectManager) {
      console.log(`[Assistant Update] Permission denied for user ${user.id}`);
      return NextResponse.json(
        { message: "You don't have permission to update this project's assistant" },
        { status: 403 }
      );
    }

    // Check if project has an assistant
    if (!project.assistantId) {
      console.log(`[Assistant Update] Project does not have an assistant ID`);
      return NextResponse.json(
        { message: "Project does not have an assistant" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    console.log(`[Assistant Update] Request body:`, body);
    
    const validationResult = updateAssistantSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.log(`[Assistant Update] Validation failed:`, validationResult.error.format());
      return NextResponse.json(
        { 
          message: "Invalid input",
          errors: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const { projectName, projectDescription } = validationResult.data;
    console.log(`[Assistant Update] Validated data: name="${projectName}", description="${projectDescription || 'null'}"`);

    // Update the assistant
    console.log(`[Assistant Update] Calling AIService.updateAssistant with ID ${project.assistantId}`);
    const updatedAssistant = await AIService.updateAssistant(
      project.assistantId,
      projectName,
      projectDescription || null
    );

    const elapsedTime = Date.now() - startTime;
    console.log(`[Assistant Update] Complete! Time taken: ${elapsedTime}ms`);
    
    return NextResponse.json(updatedAssistant);
  } catch (error) {
    console.error("Error updating assistant:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { message: "Failed to update assistant", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 