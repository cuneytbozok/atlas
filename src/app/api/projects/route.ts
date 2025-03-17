import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { withErrorHandling } from "@/lib/api/error-handler";
import { logger } from "@/lib/logger";

const prismaClient = new PrismaClient();

// Schema for project creation
const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).optional().default("active"),
  members: z.array(
    z.object({
      email: z.string().email("Invalid email address"),
      roleId: z.string().optional(),
    })
  ).optional(),
  projectManagerId: z.string().optional(),
});

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  members: Array<{
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    role: {
      id: string;
      name: string;
    };
  }>;
}

// GET - List all projects the user has access to
export const GET = withErrorHandling(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const user = await prismaClient.user.findUnique({
    where: { email: session.user.email },
    include: {
      projects: {
        include: {
          members: {
            include: {
              user: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  let projects = user.projects;

  if (status && status !== "all") {
    const validStatuses = ["active", "completed", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status value" }, { status: 400 });
    }
    projects = projects.filter((project: Project) => project.status === status);
  }

  return NextResponse.json(projects);
});

// POST - Create a new project
export const POST = withErrorHandling(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  
  try {
    // Validate request body
    const validatedData = createProjectSchema.parse(body);
    const { name, description, status, members, projectManagerId } = validatedData;

    const user = await prismaClient.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Get the admin role for the creator
    const adminRole = await prismaClient.role.findUnique({
      where: { name: "ADMIN" }
    });

    if (!adminRole) {
      logger.error(new Error("Admin role not found in database"), { 
        action: "create_project",
        email: session.user.email 
      });
      return NextResponse.json({ message: "Admin role not found" }, { status: 500 });
    }

    // Get the project manager role
    const projectManagerRole = await prismaClient.role.findUnique({
      where: { name: "PROJECT_MANAGER" }
    });

    if (!projectManagerRole) {
      logger.error(new Error("Project manager role not found in database"), { 
        action: "create_project",
        email: session.user.email 
      });
      return NextResponse.json({ message: "Project manager role not found" }, { status: 500 });
    }

    // Get the member role for other users
    const memberRole = await prismaClient.role.findUnique({
      where: { name: "USER" }
    });

    if (!memberRole) {
      logger.error(new Error("Member role not found in database"), { 
        action: "create_project",
        email: session.user.email 
      });
      return NextResponse.json({ message: "Member role not found" }, { status: 500 });
    }

    // Create the project and add members in a transaction
    const project = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the project
      const newProject = await tx.project.create({
        data: {
          name,
          description,
          status: status || "active",
          createdById: user.id,
          // Add the creator as an admin member automatically
          members: {
            create: {
              userId: user.id,
              roleId: adminRole.id,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Add additional members if provided
      if (members && members.length > 0) {
        for (const member of members) {
          // Find or create the user
          const existingUser = await tx.user.findUnique({
            where: { email: member.email },
            select: { id: true },
          });

          if (existingUser) {
            // Add existing user as member (if not already the creator)
            if (existingUser.id !== user.id) {
              // Choose role: custom role or default to member role
              const roleId = member.roleId || memberRole.id;

              // Check if the member is already in the project
              const existingMember = await tx.projectMember.findFirst({
                where: {
                  projectId: newProject.id,
                  userId: existingUser.id,
                },
              });

              if (!existingMember) {
                await tx.projectMember.create({
                  data: {
                    projectId: newProject.id,
                    userId: existingUser.id,
                    roleId,
                  },
                });
              }
            }
          } else {
            // We used to create users here, but this is no longer the preferred approach
            // Instead, we'll skip non-existent users and log it
            await logger.error(new Error(`User ${member.email} not found during project creation`), {
              action: "create_project",
              projectId: newProject.id,
              email: member.email
            });
            continue;
          }
        }
      }

      // Set project manager if provided
      if (projectManagerId) {
        const existingUser = await tx.user.findUnique({
          where: { id: projectManagerId },
          select: { id: true },
        });

        if (existingUser) {
          // Check if already a member
          const existingMember = await tx.projectMember.findFirst({
            where: {
              projectId: newProject.id,
              userId: existingUser.id,
            },
          });

          if (existingMember) {
            // Update existing member to project manager role
            await tx.projectMember.update({
              where: { id: existingMember.id },
              data: { roleId: projectManagerRole.id },
            });
          } else {
            // Add as new member with project manager role
            await tx.projectMember.create({
              data: {
                projectId: newProject.id,
                userId: existingUser.id,
                roleId: projectManagerRole.id,
              },
            });
          }
        }
      }

      // Get the updated project with all members
      return await tx.project.findUnique({
        where: { id: newProject.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Handle validation errors
      return NextResponse.json(
        { message: "Validation error", errors: error.format() },
        { status: 400 }
      );
    }
    
    // Let the withErrorHandling middleware catch and handle other errors
    throw error;
  }
}); 