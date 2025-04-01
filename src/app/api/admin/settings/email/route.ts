import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Schema for email settings
const emailSettingsSchema = z.object({
  emailFrom: z.string().email("Invalid email format").optional(),
  emailReplyTo: z.string().email("Invalid email format").optional(),
});

// GET - Get email settings (admin only)
const handleGetEmailSettings = async (request: Request) => {
  try {
    console.log("API route: Getting email settings");
    
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and has ADMIN role
    if (!session?.user) {
      console.log("No user in session - returning unauthorized");
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!session.user.roles?.includes("ADMIN")) {
      console.log("User does not have ADMIN role - returning forbidden");
      return NextResponse.json(
        { message: "Admin access required" },
        { status: 403 }
      );
    }
    
    // Get settings
    const emailFrom = await SettingsService.getEmailFrom();
    const emailReplyTo = await SettingsService.getEmailReplyTo();
    const resendApiKey = await SettingsService.getResendApiKey();
    
    return NextResponse.json({
      emailFrom,
      emailReplyTo,
      isResendApiKeySet: !!resendApiKey,
      // Never return the actual API key, just whether it's set
    });
  } catch (error) {
    console.error("Error in handleGetEmailSettings:", error);
    throw error; // Let the error middleware handle it
  }
};

// POST - Set email settings
const handleSetEmailSettings = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = emailSettingsSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.format() },
      { status: 400 }
    );
  }
  
  const { emailFrom, emailReplyTo } = result.data;
  
  // Save settings - only if they are provided
  if (emailFrom !== undefined) {
    await SettingsService.setEmailFrom(
      emailFrom,
      session?.user?.id
    );
  }
  
  if (emailReplyTo !== undefined) {
    await SettingsService.setEmailReplyTo(
      emailReplyTo,
      session?.user?.id
    );
  }
  
  return NextResponse.json(
    { message: "Email settings saved successfully" }
  );
};

// Export the handler functions with permission middleware
export const GET = withErrorHandling(
  withPermission(handleGetEmailSettings, { requiredRole: "ADMIN" })
);

export const POST = withErrorHandling(
  withPermission(handleSetEmailSettings, { requiredRole: "ADMIN" })
); 