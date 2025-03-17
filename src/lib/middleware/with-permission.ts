import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type ApiHandler = (
  request: Request,
  context: { params: Record<string, string> }
) => Promise<Response>;

type PermissionOptions = {
  requiredRole?: string;
  requiredRoles?: string[];
  checkFunction?: (userId: string, params: Record<string, string>) => Promise<boolean>;
};

/**
 * Middleware to check if a user has the required permissions to access an API endpoint
 * @param handler - The API route handler
 * @param options - Permission options for this route
 * @returns A wrapped handler with permission checking
 */
export function withPermission(
  handler: ApiHandler,
  options: PermissionOptions
): ApiHandler {
  return async (request: Request, context: { params: Record<string, string> }) => {
    try {
      // Get the user's session
      const session = await getServerSession(authOptions);
      
      // Check authentication
      if (!session?.user?.email) {
        return NextResponse.json(
          { message: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      // Get the user ID
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

      // Get the user's roles from the session
      const userRoles = session.user.roles || [];
      let hasPermission = false;

      // Check if user has the required role
      if (options.requiredRole) {
        hasPermission = userRoles.includes(options.requiredRole);
      } 
      // Check if user has any of the required roles
      else if (options.requiredRoles && options.requiredRoles.length > 0) {
        hasPermission = options.requiredRoles.some(role => userRoles.includes(role));
      } 
      // Use custom permission check function if provided
      else if (options.checkFunction) {
        hasPermission = await options.checkFunction(user.id, context.params);
      } 
      // If no checks are specified, default to allowed
      else {
        hasPermission = true;
      }

      // If user doesn't have permission, return forbidden response
      if (!hasPermission) {
        return NextResponse.json(
          { message: "Forbidden: You don't have permission to access this resource" },
          { status: 403 }
        );
      }

      // User has permission, proceed with the handler
      return handler(request, context);
    } catch (error) {
      // Log the error
      await logger.error(error, {
        type: 'permission_error',
        url: request.url,
        method: request.method,
        params: context.params,
      });

      // Return appropriate error response
      return NextResponse.json(
        { message: "An error occurred while checking permissions" },
        { status: 500 }
      );
    }
  };
}

/**
 * Check if a user is the creator of a project or has admin role in the project
 */
export async function isProjectAdmin(userId: string, params: Record<string, string>): Promise<boolean> {
  try {
    const projectId = params.id;
    if (!projectId) return false;

    // Check if user is the creator
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true }
    });

    if (project?.createdById === userId) return true;

    // Check if user is an admin of the project
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        role: {
          name: "ADMIN"
        }
      }
    });

    return !!membership;
  } catch (error) {
    console.error("Error checking project permissions:", error);
    return false;
  }
}

/**
 * Check if a user is a member of a project (any role)
 */
export async function isProjectMember(userId: string, params: Record<string, string>): Promise<boolean> {
  try {
    const projectId = params.id;
    if (!projectId) return false;

    // Check if user is the creator
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true }
    });

    if (project?.createdById === userId) return true;

    // Check if user is a member of the project
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    return !!membership;
  } catch (error) {
    console.error("Error checking project membership:", error);
    return false;
  }
} 