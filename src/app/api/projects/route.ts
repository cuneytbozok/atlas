import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
export async function GET(request: Request) {
  try {
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
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { message: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST - Create a new project
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Project creation request body:", body);
    const { name, description, members, projectManagerId } = body;

    if (!name) {
      return NextResponse.json({ message: "Project name is required" }, { status: 400 });
    }

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
      console.error("Admin role not found in database");
      return NextResponse.json({ message: "Admin role not found" }, { status: 500 });
    }

    // Get the project manager role
    const projectManagerRole = await prismaClient.role.findUnique({
      where: { name: "PROJECT_MANAGER" }
    });

    if (!projectManagerRole) {
      console.error("Project manager role not found in database");
      return NextResponse.json({ message: "Project manager role not found" }, { status: 500 });
    }

    // Get the member role for other users
    const memberRole = await prismaClient.role.findUnique({
      where: { name: "USER" }
    });

    if (!memberRole) {
      console.error("Member role not found in database");
      return NextResponse.json({ message: "Member role not found" }, { status: 500 });
    }

    console.log("Found roles:", { adminRole, projectManagerRole, memberRole });

    // Create the project with a transaction to ensure all operations succeed
    const project = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the project
      const newProject = await tx.project.create({
        data: {
          name,
          description,
          createdById: user.id,
        }
      });

      console.log("Created project:", newProject);

      // Add creator as admin
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: user.id,
          roleId: adminRole.id
        }
      });

      // Add project manager if provided
      if (projectManagerId) {
        const projectManager = await tx.user.findUnique({
          where: { id: projectManagerId },
          select: { id: true }
        });

        if (projectManager) {
          // Check if user is already a member (e.g., the creator)
          const existingMember = await tx.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId: newProject.id,
                userId: projectManager.id
              }
            }
          });

          if (!existingMember) {
            await tx.projectMember.create({
              data: {
                projectId: newProject.id,
                userId: projectManager.id,
                roleId: projectManagerRole.id
              }
            });
          } else {
            // Update the role to project manager if already a member
            await tx.projectMember.update({
              where: {
                projectId_userId: {
                  projectId: newProject.id,
                  userId: projectManager.id
                }
              },
              data: {
                roleId: projectManagerRole.id
              }
            });
          }

          // Ensure the user has the PROJECT_MANAGER role at the system level
          const hasProjectManagerRole = await tx.userRole.findFirst({
            where: {
              userId: projectManager.id,
              roleId: projectManagerRole.id
            }
          });

          if (!hasProjectManagerRole) {
            await tx.userRole.create({
              data: {
                userId: projectManager.id,
                roleId: projectManagerRole.id
              }
            });
          }
        }
      }

      // Add members if provided
      if (members && members.length > 0) {
        console.log("Adding members:", members);
        for (const member of members) {
          // Find the user by email
          const memberUser = await tx.user.findUnique({
            where: { email: member.email },
            select: { id: true }
          });

          if (memberUser) {
            // Check if user is already a member (e.g., the creator or project manager)
            const existingMember = await tx.projectMember.findUnique({
              where: {
                projectId_userId: {
                  projectId: newProject.id,
                  userId: memberUser.id
                }
              }
            });

            if (!existingMember) {
              await tx.projectMember.create({
                data: {
                  projectId: newProject.id,
                  userId: memberUser.id,
                  roleId: memberRole.id
                }
              });
            }
          } else {
            console.warn(`User not found for email: ${member.email}`);
          }
        }
      }

      return newProject;
    });

    // Fetch the complete project with members
    const completeProject = await prismaClient.project.findUnique({
      where: { id: project.id },
      include: {
        members: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(completeProject);
  } catch (error) {
    console.error("Detailed error creating project:", error);
    if (error instanceof PrismaClientKnownRequestError) {
      console.error("Prisma error code:", error.code);
      console.error("Prisma error meta:", error.meta);
    }
    return NextResponse.json(
      { message: "Failed to create project", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 