import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Schema for setting values
const settingSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string().optional(),
  description: z.string().optional(),
  isEncrypted: z.boolean().default(false),
});

// GET - Fetch all settings (admin only)
const handleGetAllSettings = async () => {
  const settings = await SettingsService.getAllSettings();
  return NextResponse.json(settings);
};

export const GET = withErrorHandling(
  withPermission(handleGetAllSettings, { requiredRole: "ADMIN" })
);

// POST - Create or update a setting
const handleCreateOrUpdateSetting = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = settingSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.format() },
      { status: 400 }
    );
  }
  
  const { key, value, isEncrypted, description } = result.data;
  
  // Handle empty value as delete operation
  if (value === "" || value === null || value === undefined) {
    await SettingsService.deleteSetting(key);
    return NextResponse.json(
      { message: `Setting '${key}' deleted successfully` }
    );
  }
  
  // Create or update the setting
  const setting = await SettingsService.setSetting(
    key,
    value as string,
    isEncrypted,
    session?.user?.id,
    description
  );
  
  return NextResponse.json(
    { 
      message: `Setting '${key}' saved successfully`,
      setting: {
        ...setting,
        value: isEncrypted ? '***' : setting.value
      }
    }
  );
};

export const POST = withErrorHandling(
  withPermission(handleCreateOrUpdateSetting, { requiredRole: "ADMIN" })
); 