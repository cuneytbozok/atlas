import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { z } from "zod";

// Schema for model validation
const modelSchema = z.object({
  model: z.string().min(1, "Model name is required"),
});

// GET - Check current model setting (admin only)
const handleGetModel = async () => {
  try {
    console.log("API route: Getting OpenAI model setting");
    
    // Get the current model
    const model = await SettingsService.getOpenAIModel();
    
    return NextResponse.json({
      model: model,
    });
  } catch (error) {
    console.error("Error in handleGetModel:", error);
    throw error; // Let the error middleware handle it
  }
};

export const GET = withErrorHandling(
  withPermission(handleGetModel, { requiredRole: "ADMIN" })
);

// POST - Set OpenAI model
const handleSetModel = async (request: Request) => {
  const session = await getServerSession(authOptions);
  const data = await request.json();
  
  // Validate request data
  const result = modelSchema.safeParse(data);
  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.format() },
      { status: 400 }
    );
  }
  
  const { model } = result.data;
  
  // Save the model setting
  await SettingsService.setOpenAIModel(
    model,
    session?.user?.id
  );
  
  return NextResponse.json(
    { message: "OpenAI model saved successfully", model }
  );
};

export const POST = withErrorHandling(
  withPermission(handleSetModel, { requiredRole: "ADMIN" })
); 