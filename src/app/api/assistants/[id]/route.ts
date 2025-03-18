import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai-service";
import { z } from "zod";

// Schema for updating assistant
const updateAssistantSchema = z.object({
  name: z.string().min(1, "Assistant name is required").optional(),
  model: z.string().min(1, "Model is required").optional(),
  instructions: z.string().optional(),
  projectName: z.string().min(1, "Project name is required"),
  projectDescription: z.string().nullable().optional(),
});

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

    // Use params destructuring to properly handle the dynamic route parameter
    const { id: assistantId } = params;

    // Get the assistant
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
      select: {
        id: true,
        name: true,
        openaiAssistantId: true,
        model: true,
        configuration: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        }
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

// PUT - Update an assistant
export async function PUT(
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
        { message: "Only administrators can update assistants" },
        { status: 403 }
      );
    }

    // Use params destructuring to properly handle the dynamic route parameter
    const { id: assistantId } = params;

    // Get the assistant to make sure it exists
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });

    if (!assistant) {
      return NextResponse.json(
        { message: "Assistant not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateAssistantSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          message: "Invalid input",
          errors: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const { name, model, instructions, projectName, projectDescription } = validationResult.data;

    // Prepare update data for database
    let dbUpdateData: any = {};
    
    // Handle custom instruction update if provided
    let customInstructions = instructions;
    if (instructions) {
      // Extract and handle configuration safely
      let existingConfig: Record<string, any> = {};
      
      if (assistant.configuration && typeof assistant.configuration === 'object') {
        existingConfig = assistant.configuration as Record<string, any>;
      }
      
      // Update configuration with new instructions
      dbUpdateData.configuration = {
        ...existingConfig,
        instructions: customInstructions
      };
    }

    // Update model if provided
    if (model) {
      dbUpdateData.model = model;
    }

    // Update name if provided
    if (name) {
      dbUpdateData.name = name;
    }

    // First update in our database
    let updatedAssistant = await prisma.assistant.update({
      where: { id: assistantId },
      data: dbUpdateData
    });

    // Then update in OpenAI using the AIService
    try {
      updatedAssistant = await AIService.updateAssistant(
        assistantId,
        projectName,
        projectDescription || null,
        name // Pass the custom name if provided
      );
      
      // If custom instructions were provided, update them again in our DB
      // because AIService.updateAssistant might have overwritten them
      if (customInstructions) {
        updatedAssistant = await prisma.assistant.update({
          where: { id: assistantId },
          data: {
            configuration: {
              ...(updatedAssistant.configuration as object || {}),
              instructions: customInstructions
            }
          }
        });
      }
    } catch (error) {
      console.error("Error updating assistant in OpenAI:", error);
      return NextResponse.json(
        { message: "Updated in database but failed to update in OpenAI", error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedAssistant);
  } catch (error) {
    console.error("Error updating assistant:", error);
    return NextResponse.json(
      { message: "Failed to update assistant", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 