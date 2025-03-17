import { prisma } from '@/lib/prisma';

/**
 * Check if a user has a specific permission through any of their roles
 * @param userId - The user's ID
 * @param permissionName - The name of the permission to check
 * @returns True if the user has the permission, false otherwise
 */
export async function userHasPermission(
  userId: string, 
  permissionName: string
): Promise<boolean> {
  try {
    // Get all roles with the specific permission for this user
    const userRoleWithPermission = await prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          rolePermissions: {
            some: {
              permission: {
                name: permissionName
              }
            }
          }
        }
      }
    });
    
    return !!userRoleWithPermission;
  } catch (error) {
    console.error(`Error checking permission "${permissionName}" for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a user has all of the specified permissions through their roles
 * @param userId - The user's ID
 * @param permissionNames - Array of permission names to check
 * @returns True if the user has all permissions, false otherwise
 */
export async function userHasAllPermissions(
  userId: string, 
  permissionNames: string[]
): Promise<boolean> {
  try {
    // For each permission, check if the user has it
    const results = await Promise.all(
      permissionNames.map(permissionName => userHasPermission(userId, permissionName))
    );
    
    // User has all permissions if all checks return true
    return results.every(result => result === true);
  } catch (error) {
    console.error(`Error checking multiple permissions for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a user has any of the specified permissions through their roles
 * @param userId - The user's ID
 * @param permissionNames - Array of permission names to check
 * @returns True if the user has at least one of the permissions, false otherwise
 */
export async function userHasAnyPermission(
  userId: string, 
  permissionNames: string[]
): Promise<boolean> {
  try {
    // For each permission, check if the user has it
    const results = await Promise.all(
      permissionNames.map(permissionName => userHasPermission(userId, permissionName))
    );
    
    // User has any permission if at least one check returns true
    return results.some(result => result === true);
  } catch (error) {
    console.error(`Error checking multiple permissions for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all permissions that a user has through their roles
 * @param userId - The user's ID
 * @returns Array of permission names the user has
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    // Define types for the query result
    type RolePermission = {
      permission: {
        name: string;
      };
    };
    
    type UserRoleWithPermissions = {
      role: {
        rolePermissions: RolePermission[];
      };
    };

    // Get all user's roles with their permissions
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    }) as unknown as UserRoleWithPermissions[];
    
    // Extract unique permission names with proper typing
    const allPermissions = userRoles.flatMap((userRole: UserRoleWithPermissions) => 
      userRole.role.rolePermissions.map((rp: RolePermission) => rp.permission.name)
    );
    
    // Return unique permissions
    return [...new Set(allPermissions)];
  } catch (error) {
    console.error(`Error fetching permissions for user ${userId}:`, error);
    return [];
  }
} 