import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";
import { AIService } from "@/lib/services/ai-service";

// Schema for OpenAI Admin API key
const openAiAdminKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

// GET - Check if OpenAI Admin API key is set (admin only)
const handleCheckAdminApiKey = async (request: Request) => {
  try {
    console.log("API route: Checking OpenAI Admin API key");
    
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Debug information about session
    console.log("Session available:", !!session);
    console.log("User in session:", session?.user ? "yes" : "no");
    console.log("User roles:", session?.user?.roles || "none");
    
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
    
    // Check Admin API key
    const apiKey = await SettingsService.getOpenAIAdminApiKey();
    console.log("Admin API key found:", !!apiKey);
    
    return NextResponse.json({
      isSet: !!apiKey,
      // Never return the actual API key, just whether it's set
    });
  } catch (error) {
    console.error("Error in handleCheckAdminApiKey:", error);
    throw error; // Let the error middleware handle it
  }
};

export const GET = withErrorHandling(
  withPermission(handleCheckAdminApiKey, { requiredRole: "ADMIN" })
);

// POST - Set OpenAI Admin API key
const handleSetAdminApiKey = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = openAiAdminKeySchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.format() },
      { status: 400 }
    );
  }
  
  const { apiKey } = result.data;
  
  // Simple validation for OpenAI key format
  if (!apiKey.startsWith('sk-')) {
    return NextResponse.json(
      { message: "Invalid OpenAI API key format. Keys should start with 'sk-'" },
      { status: 400 }
    );
  }
  
  // We don't validate this key with AIService.testApiKey because 
  // the admin API key might have different permissions than the regular API key
  // Instead, we save it and let the usage endpoint verify it has the right permissions
  
  // Save the Admin API key
  await SettingsService.setOpenAIAdminApiKey(
    apiKey,
    session?.user?.id
  );
  
  return NextResponse.json(
    { message: "OpenAI Admin API key saved successfully" }
  );
};

export const POST = withErrorHandling(
  withPermission(handleSetAdminApiKey, { requiredRole: "ADMIN" })
);

// DELETE - Remove OpenAI Admin API key
const handleDeleteAdminApiKey = async () => {
  await SettingsService.deleteSetting('openai.admin.api.key');
  return NextResponse.json(
    { message: "OpenAI Admin API key removed successfully" }
  );
};

export const DELETE = withErrorHandling(
  withPermission(handleDeleteAdminApiKey, { requiredRole: "ADMIN" })
); 