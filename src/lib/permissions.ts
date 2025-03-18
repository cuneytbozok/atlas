import { prisma } from './prisma';

/**
 * Checks if a user has access to a project
 * @param projectId Project ID to check
 * @param userId User ID to check
 * @returns Boolean indicating if the user has access
 */
export async function hasProjectAccess(
  projectId: string,
  userId: string
): Promise<boolean> {
  // Check if user is a member of the project
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId
      }
    }
  });

  if (membership) {
    return true;
  }

  // Check if user is the creator of the project
  const isCreator = await prisma.project.count({
    where: {
      id: projectId,
      createdById: userId
    }
  });

  return isCreator > 0;
}

/**
 * Checks if a user is an admin
 * @param userId User ID to check
 * @returns Boolean indicating if the user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  // Check if user has the ADMIN role
  const adminRole = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        name: 'ADMIN'
      }
    }
  });

  return !!adminRole;
}

/**
 * Checks if a user can access a thread
 * @param threadId Thread ID to check
 * @param userId User ID to check
 * @returns Boolean indicating if the user has access
 */
export async function hasThreadAccess(
  threadId: string,
  userId: string
): Promise<boolean> {
  // Get the thread with its project
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      project: {
        select: {
          id: true,
          createdById: true
        }
      }
    }
  });

  if (!thread || !thread.project) {
    return false;
  }

  // Check project access
  return hasProjectAccess(thread.project.id, userId);
}

/**
 * Checks if a user is a project manager or admin
 * @param projectId Project ID to check
 * @param userId User ID to check
 * @returns Boolean indicating if the user is a project manager or admin
 */
export async function isProjectManagerOrAdmin(
  projectId: string,
  userId: string
): Promise<boolean> {
  // Check if user is an admin
  const isAdmin = await isUserAdmin(userId);
  if (isAdmin) {
    return true;
  }
  
  // Check if user is a project manager for this project
  const isProjectManager = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      role: {
        name: 'PROJECT_MANAGER'
      }
    }
  });
  
  return !!isProjectManager;
} 