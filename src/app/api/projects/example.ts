import { NextResponse } from "next/server";
import { withPermission, isProjectAdmin, isProjectMember } from "@/lib/middleware/with-permission";
import { withErrorHandling } from "@/lib/api/error-handler";
import { userHasPermission } from "@/lib/middleware/permission-utils";

/**
 * Example of using the permission middleware with a required role
 */
async function adminOnlyHandler(
  request: Request,
  context: { params: Record<string, string> }
): Promise<Response> {
  // This handler will only execute if the user has the ADMIN role
  return NextResponse.json({ message: "Admin-only resource accessed successfully" });
}

// Wrap the handler with permission middleware to require ADMIN role
export const GET = withErrorHandling(
  withPermission(adminOnlyHandler, { requiredRole: "ADMIN" })
);

/**
 * Example of using the permission middleware with multiple allowed roles
 */
async function projectManagerOrAdminHandler(
  request: Request,
  context: { params: Record<string, string> }
): Promise<Response> {
  // This handler will only execute if the user has either PROJECT_MANAGER or ADMIN role
  return NextResponse.json({ message: "Project manager or admin resource accessed successfully" });
}

// Wrap the handler with permission middleware to require either PROJECT_MANAGER or ADMIN role
export const POST = withErrorHandling(
  withPermission(projectManagerOrAdminHandler, {
    requiredRoles: ["PROJECT_MANAGER", "ADMIN"]
  })
);

/**
 * Example of using the permission middleware with a custom check function
 */
async function projectMemberHandler(
  request: Request,
  context: { params: Record<string, string> }
): Promise<Response> {
  // This handler will only execute if the user is a member of the project
  return NextResponse.json({ message: "Project member resource accessed successfully" });
}

// Wrap the handler with permission middleware to require project membership
export const PUT = withErrorHandling(
  withPermission(projectMemberHandler, {
    checkFunction: isProjectMember
  })
);

/**
 * Example of using the permission middleware with a project admin check
 */
async function projectAdminHandler(
  request: Request,
  context: { params: Record<string, string> }
): Promise<Response> {
  // This handler will only execute if the user is an admin of the project
  return NextResponse.json({ message: "Project admin resource accessed successfully" });
}

// Wrap the handler with permission middleware to require project admin role
export const PATCH = withErrorHandling(
  withPermission(projectAdminHandler, {
    checkFunction: isProjectAdmin
  })
);

/**
 * Example of using the permission middleware with a permission-level check
 */
async function createProjectHandler(
  request: Request,
  context: { params: Record<string, string> }
): Promise<Response> {
  // This handler will only execute if the user has the CREATE_PROJECT permission
  // (which might be granted through different roles)
  return NextResponse.json({ message: "Project created successfully" });
}

// Custom check function to verify the CREATE_PROJECT permission
async function hasCreateProjectPermission(userId: string): Promise<boolean> {
  return await userHasPermission(userId, 'CREATE_PROJECT');
}

// Wrap the handler with permission middleware to require CREATE_PROJECT permission
export const DELETE = withErrorHandling(
  withPermission(createProjectHandler, {
    checkFunction: hasCreateProjectPermission
  })
); 