import { SettingsService } from "./services/settings-service";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

// Define OpenAI service for server-side use
export class OpenAIService {
  private static instance: OpenAIService;
  private openai: OpenAI | null = null;
  private apiKeyChecked = false;
  private apiKeyLoaded = false;

  private constructor() {}

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Initializes the OpenAI client if an API key is configured
   * Returns true if initialization was successful, false otherwise
   */
  private async initializeClient(): Promise<boolean> {
    // Skip if we've already checked and the API key wasn't found
    if (this.apiKeyChecked && !this.apiKeyLoaded) {
      return false;
    }

    // Skip if we've already initialized the client
    if (this.openai) {
      return true;
    }

    try {
      const apiKey = await SettingsService.getOpenAIApiKey();
      this.apiKeyChecked = true;

      if (!apiKey) {
        console.warn("OpenAI API key not configured");
        return false;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.apiKeyLoaded = true;
      return true;
    } catch (error) {
      console.error("Error initializing OpenAI client:", error);
      return false;
    }
  }

  /**
   * Checks if the current user has permission to use AI features
   * Currently only checks if user is authenticated
   */
  private async checkUserPermission(): Promise<boolean> {
    try {
      const session = await getServerSession(authOptions);
      return !!session?.user;
    } catch (error) {
      console.error("Error checking user permission:", error);
      return false;
    }
  }

  /**
   * Generates a response using the OpenAI chat completions API
   * @param prompt The prompt to send to the API
   * @param options Optional configuration for the API request
   * @returns The generated text or null if an error occurred
   */
  public async generateText(
    prompt: string,
    options: { 
      model?: string,
      temperature?: number,
      max_tokens?: number 
    } = {}
  ): Promise<{ text: string | null; error?: string }> {
    try {
      // Check user permission
      const hasPermission = await this.checkUserPermission();
      if (!hasPermission) {
        return { 
          text: null, 
          error: "You must be logged in to use AI features" 
        };
      }

      // Initialize the client
      const initialized = await this.initializeClient();
      if (!initialized || !this.openai) {
        return { 
          text: null, 
          error: "OpenAI API key not configured. Please contact your administrator." 
        };
      }

      // Set default options
      const model = options.model || "gpt-3.5-turbo";
      const temperature = options.temperature ?? 0.7;
      const max_tokens = options.max_tokens ?? 500;

      // Make the API call
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
      });

      const generatedText = response.choices[0]?.message?.content || null;
      return { text: generatedText };
    } catch (error) {
      console.error("Error generating text with OpenAI:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred while generating text";
      return { text: null, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const openAIService = OpenAIService.getInstance(); 