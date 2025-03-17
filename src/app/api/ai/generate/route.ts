import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { withErrorHandling } from "@/lib/api/error-handler";
import { openAIService } from "@/lib/openai";
import { z } from "zod";

// Define request schema for the generate endpoint
const generateRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
});

/**
 * Handles text generation requests to the OpenAI API
 */
async function handleGenerate(request: Request) {
  // Get current user session
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Parse and validate the request body
  const body = await request.json().catch(() => ({}));
  const result = generateRequestSchema.safeParse(body);
  
  if (!result.success) {
    const errorMessage = result.error.errors.map(e => e.message).join(", ");
    return NextResponse.json(
      { error: `Invalid request: ${errorMessage}` },
      { status: 400 }
    );
  }

  const { prompt, model, temperature, max_tokens } = result.data;

  // Generate text using the OpenAI service
  const response = await openAIService.generateText(prompt, {
    model,
    temperature,
    max_tokens,
  });

  // Handle error case
  if (!response.text) {
    return NextResponse.json(
      { error: response.error || "Failed to generate text" },
      { status: 500 }
    );
  }

  // Return successful response
  return NextResponse.json({
    text: response.text,
  });
}

// Export the handler with error handling middleware
export const POST = withErrorHandling(handleGenerate); 