import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import prisma from "@/lib/prisma";

/**
 * GET - Check app settings and fix if necessary
 * This endpoint ensures app settings are properly initialized
 */
const handleCheckSettings = async (request: Request) => {
  try {
    console.log("Checking app settings status...");
    
    // 1. Check if the AppSetting table exists and is accessible
    let isAppSettingAccessible = false;
    try {
      const settingsCount = await prisma.appSetting.count();
      console.log(`Found ${settingsCount} settings in AppSetting table`);
      isAppSettingAccessible = true;
    } catch (error) {
      console.error("Error accessing AppSetting table:", error);
      isAppSettingAccessible = false;
    }

    // 2. Check user permissions
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the user with roles for accurate permission checking
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Extract user's roles
    const userRoles = user.userRoles.map(ur => ur.role.name);
    const hasAdminRole = userRoles.includes("ADMIN");

    // Extract user's permissions
    const permissions = user.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );
    
    const hasAppSettingsPermission = permissions.includes("MANAGE_APP_SETTINGS") || 
                                    permissions.includes("VIEW_APP_SETTINGS");

    // 3. Check default app settings existence
    const defaultSettings = await SettingsService.getAllSettings();
    
    return NextResponse.json({
      isAppSettingAccessible,
      permissions: {
        hasAdminRole,
        hasAppSettingsPermission,
        userRoles,
        permissions
      },
      settingsCount: defaultSettings.length,
      canAccessSettings: isAppSettingAccessible && hasAppSettingsPermission
    });
  } catch (error) {
    console.error("Error in handleCheckSettings:", error);
    return NextResponse.json(
      { 
        message: "Error checking app settings",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};

export const GET = withErrorHandling(handleCheckSettings); 