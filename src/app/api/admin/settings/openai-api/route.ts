import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";
import { AIService } from "@/lib/services/ai-service";

// Schema for OpenAI API key
const openAiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

// GET - Check if OpenAI API key is set (admin only)
const handleCheckApiKey = async (request: Request) => {
  try {
    console.log("API route: Checking OpenAI API key");
    
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
    
    // Check API key
    const apiKey = await SettingsService.getOpenAIApiKey();
    console.log("API key found:", !!apiKey);
    
    return NextResponse.json({
      isSet: !!apiKey,
      // Never return the actual API key, just whether it's set
    });
  } catch (error) {
    console.error("Error in handleCheckApiKey:", error);
    throw error; // Let the error middleware handle it
  }
};

export const GET = withErrorHandling(
  withPermission(handleCheckApiKey, { requiredRole: "ADMIN" })
);

// POST - Set OpenAI API key
const handleSetApiKey = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = openAiKeySchema.safeParse(data);
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
  
  // Validate that the API key works before saving it
  const isValid = await AIService.testApiKey(apiKey);
  if (!isValid) {
    return NextResponse.json(
      { message: "The API key is invalid or unable to connect to OpenAI. Please check your key and try again." },
      { status: 400 }
    );
  }
  
  // Save the API key
  await SettingsService.setOpenAIApiKey(
    apiKey,
    session?.user?.id
  );
  
  return NextResponse.json(
    { message: "OpenAI API key saved successfully" }
  );
};

export const POST = withErrorHandling(
  withPermission(handleSetApiKey, { requiredRole: "ADMIN" })
);

// DELETE - Remove OpenAI API key
const handleDeleteApiKey = async () => {
  await SettingsService.deleteSetting('openai.api.key');
  return NextResponse.json(
    { message: "OpenAI API key removed successfully" }
  );
};

export const DELETE = withErrorHandling(
  withPermission(handleDeleteApiKey, { requiredRole: "ADMIN" })
); 