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

    // Extract projectId from params after awaiting session
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
    
    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Extract projectId from params after awaiting session
    const projectId = params.id;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    try {
      // Parse the request body
      const body = await request.json();
      
      const { 
        name, 
        description, 
        status, 
        projectManagerId
      } = body;

      // Validate that name and description are not empty if provided
      if (name !== undefined && (!name || name.trim() === "")) {
        return NextResponse.json(
          { message: "Project name cannot be empty" },
          { status: 400 }
        );
      }

      if (description !== undefined && (!description || description.trim() === "")) {
        return NextResponse.json(
          { message: "Project description cannot be empty" },
          { status: 400 }
        );
      }

      // Log the update request
      console.log(`Updating project ${projectId} with:`, {
        name,
        description,
        status,
        projectManagerId: projectManagerId !== undefined ? projectManagerId : undefined,
      });

      // Update the project
      try {
        // First update the basic project details
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

        // Handle project manager assignment if provided
        if (projectManagerId !== undefined) {
          // If projectManagerId is empty, remove any existing project manager role
          if (!projectManagerId) {
            // Find current project manager
            const currentProjectManager = updatedProject.members.find(
              (member: { role: { name: string } }) => member.role.name === "PROJECT_MANAGER"
            );

            if (currentProjectManager) {
              // Find the USER role
              const userRole = await prisma.role.findFirst({
                where: { name: "USER" }
              });

              if (userRole) {
                // Downgrade the current project manager to a regular user
                await prisma.projectMember.update({
                  where: { id: currentProjectManager.id },
                  data: { roleId: userRole.id }
                });
              }
            }
          } else {
            // Find the member to promote to project manager
            const memberToPromote = updatedProject.members.find(
              (member: { user: { id: string } }) => member.user.id === projectManagerId
            );

            if (!memberToPromote) {
              return NextResponse.json(
                { message: "Selected user is not a member of this project" },
                { status: 400 }
              );
            }

            // Find the PROJECT_MANAGER role
            const projectManagerRole = await prisma.role.findFirst({
              where: { name: "PROJECT_MANAGER" }
            });

            if (!projectManagerRole) {
              return NextResponse.json(
                { message: "Project manager role not found" },
                { status: 500 }
              );
            }

            // Find current project manager (if any)
            const currentProjectManager = updatedProject.members.find(
              (member: { role: { name: string }, id: string }) => 
                member.role.name === "PROJECT_MANAGER" && member.id !== memberToPromote.id
            );

            // If there's a different current project manager, downgrade them
            if (currentProjectManager) {
              const userRole = await prisma.role.findFirst({
                where: { name: "USER" }
              });

              if (userRole) {
                await prisma.projectMember.update({
                  where: { id: currentProjectManager.id },
                  data: { roleId: userRole.id }
                });
              }
            }

            // Promote the selected member to project manager
            await prisma.projectMember.update({
              where: { id: memberToPromote.id },
              data: { roleId: projectManagerRole.id }
            });

            // Ensure the user has the PROJECT_MANAGER role at the system level
            const hasProjectManagerRole = await prisma.userRole.findFirst({
              where: {
                userId: memberToPromote.user.id,
                role: {
                  name: "PROJECT_MANAGER"
                }
              }
            });

            if (!hasProjectManagerRole) {
              await prisma.userRole.create({
                data: {
                  userId: memberToPromote.user.id,
                  roleId: projectManagerRole.id
                }
              });
            }
          }

          // Fetch the updated project with the new project manager
          const finalProject = await prisma.project.findUnique({
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

          // If name or description changed, update the assistant too
          await updateAssistantIfNeeded(projectId, finalProject, name, description);

          return NextResponse.json(finalProject);
        }

        // If name or description changed, update the assistant too
        await updateAssistantIfNeeded(projectId, updatedProject, name, description);

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

// Helper function to update the assistant if needed
async function updateAssistantIfNeeded(
  projectId: string, 
  project: any, 
  newName?: string, 
  newDescription?: string | null
) {
  if (
    (newName !== undefined || newDescription !== undefined) && 
    project && 
    project.assistantId
  ) {
    try {
      console.log(`Initiating assistant update for project ${projectId}`);
      console.log(`Project details being updated: Name=${newName !== undefined ? newName : 'unchanged'}, Description=${newDescription !== undefined ? 'provided' : 'unchanged'}`);
      
      // Import AIService directly
      const { AIService } = await import('@/lib/services/ai-service');
      
      // Use the actual name/description values for the update
      const projectName = newName !== undefined ? newName : project.name;
      const projectDescription = newDescription !== undefined ? newDescription : project.description;
      
      console.log(`Directly calling AIService.updateAssistant with ID ${project.assistantId}`);
      console.log(`Using name: "${projectName}", description: "${projectDescription}"`);
      
      // Call AIService directly instead of making an HTTP request
      const updatedAssistant = await AIService.updateAssistant(
        project.assistantId,
        projectName,
        projectDescription
      );
      
      console.log("Assistant updated successfully:", {
        id: updatedAssistant.id,
        name: updatedAssistant.name,
        updatedAt: updatedAssistant.updatedAt
      });
      
      return updatedAssistant;
    } catch (assistantError) {
      // Just log the error, don't fail the whole operation
      console.error("Error updating assistant:", assistantError);
      if (assistantError instanceof Error) {
        console.error(assistantError.stack);
      }
    }
  } else {
    console.log("No assistant update needed", {
      hasNameChange: newName !== undefined,
      hasDescriptionChange: newDescription !== undefined,
      hasAssistantId: project?.assistantId ? true : false
    });
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

    // Extract projectId from params after awaiting session
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
      select: { 
        createdById: true,
        vectorStoreId: true,
        assistantId: true,
        name: true
      }
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

    // Import the AIService for cleaning up AI resources
    const { AIService } = await import('@/lib/services/ai-service');
    
    // Clean up AI resources if they exist
    const cleanupResults = {
      assistantDeleted: false,
      vectorStoreDeleted: false,
      assistantDetails: null as any,
      vectorStoreDetails: null as any
    };
    
    // Starting with a log for audit/debugging
    console.log(`Starting deletion of project ${projectId} (${project.name}) with AI resources:`, { 
      hasAssistant: !!project.assistantId, 
      hasVectorStore: !!project.vectorStoreId 
    });
    
    // Delete assistant if it exists
    if (project.assistantId) {
      console.log(`Attempting to delete assistant ${project.assistantId} for project ${projectId}`);
      try {
        // Get assistant details before deletion for logging
        const assistant = await prisma.assistant.findUnique({
          where: { id: project.assistantId },
          select: { id: true, name: true, openaiAssistantId: true }
        });
        
        cleanupResults.assistantDetails = assistant;
        
        // Delete the assistant
        cleanupResults.assistantDeleted = await AIService.deleteAssistant(project.assistantId);
        console.log(`Assistant deletion ${cleanupResults.assistantDeleted ? 'SUCCEEDED' : 'FAILED'} for ${project.assistantId}`);
      } catch (error) {
        console.error(`Error during assistant deletion for project ${projectId}:`, error);
      }
    }
    
    // Delete vector store if it exists
    if (project.vectorStoreId) {
      console.log(`Attempting to delete vector store ${project.vectorStoreId} for project ${projectId}`);
      try {
        // Get vector store details before deletion for logging
        const vectorStore = await prisma.vectorStore.findUnique({
          where: { id: project.vectorStoreId },
          select: { id: true, name: true, openaiVectorStoreId: true }
        });
        
        cleanupResults.vectorStoreDetails = vectorStore;
        
        // Delete the vector store
        cleanupResults.vectorStoreDeleted = await AIService.deleteVectorStore(project.vectorStoreId);
        console.log(`Vector store deletion ${cleanupResults.vectorStoreDeleted ? 'SUCCEEDED' : 'FAILED'} for ${project.vectorStoreId}`);
      } catch (error) {
        console.error(`Error during vector store deletion for project ${projectId}:`, error);
      }
    }

    // Delete the project after AI resources are handled
    console.log(`Now deleting project ${projectId} (${project.name}) from database`);
    await prisma.project.delete({
      where: { id: projectId }
    });
    console.log(`Project ${projectId} (${project.name}) successfully deleted from database`);

    return NextResponse.json(
      { 
        message: "Project deleted successfully",
        aiResourcesCleanup: cleanupResults,
        project: {
          id: projectId,
          name: project.name
        }
      },
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