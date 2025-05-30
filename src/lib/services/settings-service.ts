import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Define the AppSetting type matching our schema
interface AppSetting {
  id: string;
  key: string;
  value: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  description: string | null;
}

/**
 * Service for managing application settings
 */
export class SettingsService {
  /**
   * Ensure the database connection is active
   * @returns True if connected, false otherwise
   */
  private static async ensureConnection(): Promise<boolean> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1 as result`;
      return true;
    } catch (error) {
      console.error("Database connection error:", error);
      return false;
    }
  }

  /**
   * Get a setting by key
   * @param key - The setting key
   * @returns The setting value, or null if not found
   */
  static async getSetting(key: string): Promise<string | null> {
    try {
      // Ensure database connection
      const isConnected = await this.ensureConnection();
      if (!isConnected) {
        console.error("Database connection failed when getting setting:", key);
        return null;
      }

      const setting = await prisma.appSetting.findUnique({
        where: { key }
      });

      if (!setting) {
        return null;
      }

      // Decrypt if necessary
      if (setting.isEncrypted) {
        try {
          return await decrypt(setting.value);
        } catch (error) {
          console.error(`Error decrypting setting ${key}:`, error);
          return null;
        }
      }

      return setting.value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a setting value
   * @param key - The setting key
   * @param value - The setting value
   * @param isEncrypted - Whether the value should be encrypted
   * @param createdBy - Optional user ID of who created the setting
   * @param description - Optional description of the setting
   * @returns The created or updated setting
   */
  static async setSetting(
    key: string, 
    value: string, 
    isEncrypted: boolean = false,
    createdBy?: string,
    description?: string
  ): Promise<AppSetting | null> {
    try {
      // Ensure database connection
      const isConnected = await this.ensureConnection();
      if (!isConnected) {
        console.error("Database connection failed when setting:", key);
        return null;
      }

      let valueToStore = value;

      // Encrypt if necessary
      if (isEncrypted && value) {
        try {
          valueToStore = await encrypt(value);
        } catch (error) {
          console.error(`Error encrypting setting ${key}:`, error);
          throw new Error('Failed to encrypt setting value');
        }
      }

      // Update or create the setting
      return await prisma.appSetting.upsert({
        where: { key },
        update: {
          value: valueToStore,
          isEncrypted,
          updatedAt: new Date(),
          description: description !== undefined ? description : undefined
        },
        create: {
          key,
          value: valueToStore,
          isEncrypted,
          createdBy: createdBy || null,
          description: description || null
        }
      });
    } catch (error) {
      console.error(`Error setting value for ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a setting
   * @param key - The setting key to delete
   */
  static async deleteSetting(key: string): Promise<boolean> {
    try {
      // Ensure database connection
      const isConnected = await this.ensureConnection();
      if (!isConnected) {
        console.error("Database connection failed when deleting setting:", key);
        return false;
      }

      await prisma.appSetting.delete({
        where: { key }
      }).catch((error: PrismaClientKnownRequestError) => {
        // Ignore error if setting doesn't exist
        if (error.code !== 'P2025') { // P2025 is Prisma's "Record not found" error
          throw error;
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all settings (for admin use only)
   * @param includeEncrypted - Whether to include encrypted settings (values will be "***" for security)
   * @returns Array of all settings
   */
  static async getAllSettings(includeEncrypted: boolean = true): Promise<AppSetting[]> {
    try {
      // Ensure database connection
      const isConnected = await this.ensureConnection();
      if (!isConnected) {
        console.error("Database connection failed when getting all settings");
        return [];
      }

      const settings = await prisma.appSetting.findMany({
        orderBy: {
          key: 'asc'
        }
      });

      // Mask encrypted values for security
      return settings.map((setting: AppSetting) => ({
        ...setting,
        value: setting.isEncrypted ? '***' : setting.value
      }));
    } catch (error) {
      console.error("Error getting all settings:", error);
      return [];
    }
  }

  /**
   * Set the OpenAI API key
   * @param apiKey - The OpenAI API key
   * @param createdBy - Optional user ID of who set the key
   * @returns The created or updated setting
   */
  static async setOpenAIApiKey(apiKey: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'openai.api.key',
      apiKey,
      true, // Always encrypt API keys
      createdBy,
      'OpenAI API Key for accessing AI services'
    );
  }

  /**
   * Get the OpenAI API key
   * @returns The API key, or null if not set
   */
  static async getOpenAIApiKey(): Promise<string | null> {
    return this.getSetting('openai.api.key');
  }

  /**
   * Set the OpenAI model name
   * @param model - The OpenAI model name (e.g., "gpt-4", "gpt-3.5-turbo")
   * @param createdBy - Optional user ID of who set the model
   * @returns The created or updated setting
   */
  static async setOpenAIModel(model: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'openai.model',
      model,
      false, // No need to encrypt model names
      createdBy,
      'OpenAI Model name for AI services'
    );
  }

  /**
   * Get the OpenAI model name
   * @returns The model name, or the default model if not set
   */
  static async getOpenAIModel(): Promise<string> {
    const model = await this.getSetting('openai.model');
    return model || 'gpt-4o'; // Default to gpt-4o if not set
  }

  /**
   * Set the OpenAI Admin API key (for analytics/usage data)
   * @param apiKey - The OpenAI Admin API key with usage read permissions
   * @param createdBy - Optional user ID of who set the key
   * @returns The created or updated setting
   */
  static async setOpenAIAdminApiKey(apiKey: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'openai.admin.api.key',
      apiKey,
      true, // Always encrypt API keys
      createdBy,
      'OpenAI Admin API Key with usage read permissions for analytics'
    );
  }

  /**
   * Get the OpenAI Admin API key
   * @returns The API key (decrypted), or null if not set
   */
  static async getOpenAIAdminApiKey(): Promise<string | null> {
    return this.getSetting('openai.admin.api.key');
  }

  /**
   * Delete the OpenAI Admin API key
   * @returns True if deleted successfully, false otherwise
   */
  static async deleteOpenAIAdminApiKey(): Promise<boolean> {
    return this.deleteSetting('openai.admin.api.key');
  }
  
  /**
   * Set the Resend API key for email functionality
   * @param apiKey - The Resend API key
   * @param createdBy - Optional user ID of who set the key
   * @returns The created or updated setting
   */
  static async setResendApiKey(apiKey: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'email.resend.api.key',
      apiKey,
      true, // Always encrypt API keys
      createdBy,
      'Resend API Key for sending emails'
    );
  }

  /**
   * Get the Resend API key
   * @returns The API key (decrypted), or null if not set
   */
  static async getResendApiKey(): Promise<string | null> {
    return this.getSetting('email.resend.api.key');
  }

  /**
   * Delete the Resend API key
   * @returns True if deleted successfully, false otherwise
   */
  static async deleteResendApiKey(): Promise<boolean> {
    return this.deleteSetting('email.resend.api.key');
  }
  
  /**
   * Set the email from address
   * @param email - The email address to use as sender
   * @param createdBy - Optional user ID of who set the email
   * @returns The created or updated setting
   */
  static async setEmailFrom(email: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'email.from',
      email,
      false, // No need to encrypt email addresses
      createdBy,
      'From email address for outgoing emails'
    );
  }

  /**
   * Get the email from address
   * @returns The email address, or null if not set
   */
  static async getEmailFrom(): Promise<string | null> {
    return this.getSetting('email.from');
  }
  
  /**
   * Set the email reply-to address
   * @param email - The email address to use for replies
   * @param createdBy - Optional user ID of who set the email
   * @returns The created or updated setting
   */
  static async setEmailReplyTo(email: string, createdBy?: string): Promise<AppSetting | null> {
    return this.setSetting(
      'email.replyTo',
      email,
      false, // No need to encrypt email addresses
      createdBy,
      'Reply-to email address for outgoing emails'
    );
  }

  /**
   * Get the email reply-to address
   * @returns The email address, or null if not set
   */
  static async getEmailReplyTo(): Promise<string | null> {
    return this.getSetting('email.replyTo');
  }
} 