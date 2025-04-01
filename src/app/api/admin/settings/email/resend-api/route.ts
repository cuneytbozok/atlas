import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Schema for Resend API key
const resendApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

// GET - Check if Resend API key is set (admin only)
const handleCheckApiKey = async (request: Request) => {
  try {
    console.log("API route: Checking Resend API key");
    
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
    
    // Check API key
    const apiKey = await SettingsService.getResendApiKey();
    console.log("Resend API key found:", !!apiKey);
    
    return NextResponse.json({
      isSet: !!apiKey,
      // Never return the actual API key, just whether it's set
    });
  } catch (error) {
    console.error("Error in handleCheckApiKey:", error);
    throw error; // Let the error middleware handle it
  }
};

// POST - Set Resend API key
const handleSetApiKey = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = resendApiKeySchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.format() },
      { status: 400 }
    );
  }
  
  const { apiKey } = result.data;
  
  // Simple validation for Resend key format
  if (!apiKey.startsWith('re_')) {
    return NextResponse.json(
      { message: "Invalid Resend API key format. Keys should start with 're_'" },
      { status: 400 }
    );
  }
  
  // TODO: Validate that the API key works before saving it
  // This would require a test call to the Resend API
  // For now, we just save it without validation
  
  // Save the API key
  await SettingsService.setResendApiKey(
    apiKey,
    session?.user?.id
  );
  
  return NextResponse.json(
    { message: "Resend API key saved successfully" }
  );
};

// DELETE - Remove Resend API key
const handleDeleteApiKey = async (request: Request) => {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and has ADMIN role
    if (!session?.user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!session.user.roles?.includes("ADMIN")) {
      return NextResponse.json(
        { message: "Admin access required" },
        { status: 403 }
      );
    }
    
    // Delete the API key
    const success = await SettingsService.deleteResendApiKey();
    
    if (success) {
      return NextResponse.json(
        { message: "Resend API key removed successfully" }
      );
    } else {
      return NextResponse.json(
        { message: "Failed to remove Resend API key. It may already be deleted." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in handleDeleteApiKey:", error);
    throw error; // Let the error middleware handle it
  }
};

// Export the handler functions with permission middleware
export const GET = withErrorHandling(
  withPermission(handleCheckApiKey, { requiredRole: "ADMIN" })
);

export const POST = withErrorHandling(
  withPermission(handleSetApiKey, { requiredRole: "ADMIN" })
);

export const DELETE = withErrorHandling(
  withPermission(handleDeleteApiKey, { requiredRole: "ADMIN" })
); 