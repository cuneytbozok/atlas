import { prisma } from '@/lib/prisma';
import { SettingsService } from './settings-service';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { Prisma, PrismaClient } from '@prisma/client';
import 'server-only';

/**
 * Service for managing AI-related resources like Vector Stores and Assistants
 */
export class AIService {
  private static openai: OpenAI | null = null;

  /**
   * Initialize the OpenAI client
   * @returns An OpenAI client instance
   */
  private static async getClient(): Promise<OpenAI> {
    if (this.openai) {
      return this.openai;
    }

    const apiKey = await SettingsService.getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.openai = new OpenAI({
      apiKey
    });

    return this.openai;
  }

  /**
   * Creates a vector store for a project
   * @param projectId - ID of the project
   * @param name - Name of the vector store
   * @param description - Optional description
   * @returns The created vector store
   */
  static async createVectorStore(
    projectId: string,
    name: string,
    description?: string
  ) {
    try {
      const client = await this.getClient();
      const apiKey = await SettingsService.getOpenAIApiKey();
      
      console.log(`Creating vector store for project ${projectId} with name ${name}`);
      
      // Array of strategies to try
      const strategies = [
        // Strategy 1: Try the SDK method directly
        async () => {
          try {
            console.log('Trying strategy 1: Using OpenAI SDK directly');
            const result = await client.vectorStores.create({ name });
            console.log('Vector store created using SDK');
            return result;
          } catch (error: any) {
            console.log('Strategy 1 failed:', error.message);
            throw error;
          }
        },
        
        // Strategy 2: Try with No beta flag
        async () => {
          console.log('Trying strategy 2: Direct API call with no beta flag');
          const response = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ name })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed: ${JSON.stringify(errorData)}`);
          }
          
          const result = await response.json();
          console.log('Vector store created using direct API call (no beta flag)');
          return result;
        },
        
        // Strategy 3: Try with assistants=v1 beta flag
        async () => {
          console.log('Trying strategy 3: Using assistants=v1 beta flag');
          const response = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'OpenAI-Beta': 'assistants=v1'
            },
            body: JSON.stringify({ name })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed: ${JSON.stringify(errorData)}`);
          }
          
          const result = await response.json();
          console.log('Vector store created using assistants=v1 beta flag');
          return result;
        }
      ];
      
      // Try each strategy until one works
      let vectorStore = null;
      let lastError = null;
      
      for (const strategy of strategies) {
        try {
          vectorStore = await strategy();
          if (vectorStore) break; // Success!
        } catch (error) {
          lastError = error;
          // Continue to the next strategy
        }
      }
      
      // If we still don't have a vector store, throw the last error
      if (!vectorStore) {
        if (lastError) throw lastError;
        throw new Error('Failed to create vector store: all strategies failed');
      }
      
      console.log(`Vector store created successfully: ${vectorStore.id}`);
      
      // Save the vector store in our database using transaction
      const dbVectorStore = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create the vector store
        const newVectorStore = await tx.vectorStore.create({
          data: {
            name: name,
            openaiVectorStoreId: vectorStore.id,
            configuration: {
              description: description || `Vector store for project: ${name}`
            }
          }
        });

        // Update the project with the vector store ID
        await tx.project.update({
          where: { id: projectId },
          data: {
            vectorStoreId: newVectorStore.id
          }
        });

        return newVectorStore;
      });

      return dbVectorStore;
    } catch (error) {
      console.error(`Error creating vector store for project ${projectId}:`, error);
      logger.error(error, { 
        action: 'create_vector_store', 
        projectId 
      });
      throw error;
    }
  }

  /**
   * Creates an assistant for a project
   * @param projectId - ID of the project
   * @param projectName - Name of the project
   * @param projectDescription - Description of the project
   * @param vectorStoreId - ID of the vector store to link (from our database)
   * @returns The created assistant
   */
  static async createAssistant(
    projectId: string,
    projectName: string,
    projectDescription: string | null,
    vectorStoreId: string
  ) {
    try {
      const client = await this.getClient();
      
      // Get the vector store
      const vectorStore = await prisma.vectorStore.findUnique({
        where: { id: vectorStoreId }
      });
      
      if (!vectorStore?.openaiVectorStoreId) {
        throw new Error('Vector store not found or missing OpenAI ID');
      }
      
      // Get the model to use
      const model = await SettingsService.getOpenAIModel();

      // Create system instructions based on the project
      const instructions = `You are an AI assistant for the project "${projectName}". \
${projectDescription ? `\nProject description: ${projectDescription}` : ''} \
\nYour role is to help users with this project by answering questions, providing insights, and assisting with tasks. \
\nWhen users ask about the project, utilize the associated files and knowledge to provide accurate information.`;

      // Create the assistant in OpenAI
      const assistant = await client.beta.assistants.create({
        name: `${projectName} Assistant`,
        description: `Assistant for project: ${projectName}`,
        model: model,
        instructions: instructions,
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.openaiVectorStoreId]
          }
        },
        metadata: {
          projectId: projectId
        }
      });

      console.log(`Assistant created successfully: ${assistant.id} linked to vector store: ${vectorStore.openaiVectorStoreId}`);

      // Save the assistant in our database
      const dbAssistant = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create the assistant
        const newAssistant = await tx.assistant.create({
          data: {
            name: `${projectName} Assistant`,
            openaiAssistantId: assistant.id,
            model: model,
            configuration: {
              instructions: instructions,
              tools: ["file_search"],
              projectId: projectId
            }
          }
        });

        // Update the project with the assistant ID
        await tx.project.update({
          where: { id: projectId },
          data: {
            assistantId: newAssistant.id
          }
        });

        return newAssistant;
      });

      return dbAssistant;
    } catch (error) {
      logger.error(error, {
        action: 'create_assistant',
        projectId
      });
      throw error;
    }
  }

  /**
   * Sets up AI resources (vector store and assistant) for a project
   * @param projectId - ID of the project
   * @param projectName - Name of the project
   * @param projectDescription - Description of the project
   * @returns The created assistant and vector store
   */
  static async setupProjectAI(
    projectId: string,
    projectName: string,
    projectDescription: string | null
  ) {
    try {
      console.log(`Setting up AI resources for project ${projectId}: ${projectName}`);
      
      // Create vector store
      const vectorStore = await this.createVectorStore(
        projectId,
        `${projectName} Vector Store`,
        projectDescription || undefined
      );
      
      console.log(`Vector store created with ID: ${vectorStore.id}, OpenAI ID: ${vectorStore.openaiVectorStoreId}`);
      
      // Create assistant linked to the vector store
      const assistant = await this.createAssistant(
        projectId,
        projectName,
        projectDescription,
        vectorStore.id
      );
      
      console.log(`Setup complete - Project ${projectId} now has:`);
      console.log(`- Vector Store: ${vectorStore.id} (OpenAI ID: ${vectorStore.openaiVectorStoreId})`);
      console.log(`- Assistant: ${assistant.id} (OpenAI ID: ${assistant.openaiAssistantId})`);
      
      // Verify the project has been updated with the IDs
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, vectorStoreId: true, assistantId: true }
      });
      
      console.log(`Project record updated:`, project);
      
      return {
        vectorStore,
        assistant,
        project
      };
    } catch (error) {
      console.error(`Error setting up AI resources for project ${projectId}:`, error);
      logger.error(error, {
        action: 'setup_project_ai',
        projectId
      });
      throw error;
    }
  }

  /**
   * Verifies if an assistant is properly connected to a vector store
   * @param assistantId - OpenAI Assistant ID
   * @param vectorStoreId - OpenAI Vector Store ID
   * @returns Result of the verification
   */
  static async verifyAssistantVectorStoreConnection(
    assistantId: string,
    vectorStoreId: string
  ) {
    try {
      console.log(`Verifying connection between assistant ${assistantId} and vector store ${vectorStoreId}`);
      
      const client = await this.getClient();
      
      // Get assistant details from OpenAI
      const assistant = await client.beta.assistants.retrieve(assistantId);
      
      console.log(`Retrieved assistant: ${assistant.id}`);
      
      // Check if assistant has file_search tool
      const hasFileSearchTool = assistant.tools.some(tool => tool.type === "file_search");
      
      // Check if vector store is connected in tool_resources
      let isVectorStoreConnected = false;
      let vectorStoreIds: string[] = [];
      
      if (assistant.tool_resources?.file_search?.vector_store_ids) {
        vectorStoreIds = assistant.tool_resources.file_search.vector_store_ids;
        isVectorStoreConnected = vectorStoreIds.includes(vectorStoreId);
      }
      
      return {
        isConnected: hasFileSearchTool && isVectorStoreConnected,
        details: {
          assistant: {
            id: assistant.id,
            name: assistant.name,
            hasFileSearchTool
          },
          vectorStore: {
            id: vectorStoreId,
            isConnected: isVectorStoreConnected,
            connectedVectorStores: vectorStoreIds
          }
        }
      };
    } catch (error) {
      console.error(`Error verifying assistant-vector store connection:`, error);
      logger.error(error, {
        action: 'verify_assistant_vector_store_connection',
        assistantId,
        vectorStoreId
      });
      throw error;
    }
  }

  /**
   * Deletes an assistant from OpenAI
   * @param assistantId - ID of the assistant in our database
   * @returns True if successful, false if already deleted or not found
   */
  static async deleteAssistant(assistantId: string): Promise<boolean> {
    try {
      // First get the assistant from our database to get the OpenAI ID
      const assistant = await prisma.assistant.findUnique({
        where: { id: assistantId }
      });

      if (!assistant?.openaiAssistantId) {
        console.log(`Assistant ${assistantId} not found or missing OpenAI ID`);
        return false;
      }

      const openaiAssistantId = assistant.openaiAssistantId;
      console.log(`Deleting assistant ${assistantId} (OpenAI ID: ${openaiAssistantId})`);

      // Get the OpenAI client
      const client = await this.getClient();

      // Delete the assistant in OpenAI
      await client.beta.assistants.del(openaiAssistantId);
      console.log(`Successfully deleted assistant in OpenAI: ${openaiAssistantId}`);

      // Delete the assistant in our database
      await prisma.assistant.delete({
        where: { id: assistantId }
      });
      console.log(`Successfully deleted assistant in database: ${assistantId}`);

      return true;
    } catch (error) {
      // Log the error but don't throw it to prevent blocking the project deletion
      console.error(`Error deleting assistant ${assistantId}:`, error);
      logger.error(error, {
        action: 'delete_assistant',
        assistantId
      });
      return false;
    }
  }

  /**
   * Deletes a vector store from OpenAI
   * @param vectorStoreId - ID of the vector store in our database
   * @returns True if successful, false if already deleted or not found
   */
  static async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
    try {
      // First get the vector store from our database to get the OpenAI ID
      const vectorStore = await prisma.vectorStore.findUnique({
        where: { id: vectorStoreId }
      });

      if (!vectorStore?.openaiVectorStoreId) {
        console.log(`Vector store ${vectorStoreId} not found or missing OpenAI ID`);
        return false;
      }

      const openaiVectorStoreId = vectorStore.openaiVectorStoreId;
      console.log(`Deleting vector store ${vectorStoreId} (OpenAI ID: ${openaiVectorStoreId})`);

      // Get the OpenAI client
      const client = await this.getClient();

      // Delete the vector store in OpenAI
      await client.vectorStores.del(openaiVectorStoreId);
      console.log(`Successfully deleted vector store in OpenAI: ${openaiVectorStoreId}`);

      // Delete the vector store in our database
      await prisma.vectorStore.delete({
        where: { id: vectorStoreId }
      });
      console.log(`Successfully deleted vector store in database: ${vectorStoreId}`);

      return true;
    } catch (error) {
      // Log the error but don't throw it to prevent blocking the project deletion
      console.error(`Error deleting vector store ${vectorStoreId}:`, error);
      logger.error(error, {
        action: 'delete_vector_store',
        vectorStoreId
      });
      return false;
    }
  }

  /**
   * Uploads a file to OpenAI
   * @param fileBytes - The file content as Uint8Array
   * @param fileName - The name of the file
   * @param mimeType - The MIME type of the file
   * @returns The OpenAI file ID
   */
  static async uploadFileToOpenAI(
    fileBytes: Uint8Array,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      const client = await this.getClient();
      
      console.log(`Uploading file ${fileName} to OpenAI`);
      
      // Create a temporary file with the correct name and extension
      const file = new File([fileBytes], fileName, { type: mimeType });
      
      // Upload the file to OpenAI
      const response = await client.files.create({
        file,
        purpose: "assistants"
      });
      
      console.log(`File uploaded successfully with ID: ${response.id}`);
      
      return response.id;
    } catch (error) {
      console.error("Error uploading file to OpenAI:", error);
      throw error;
    }
  }

  /**
   * Adds a file to a vector store
   * @param fileId - The OpenAI file ID
   * @param vectorStoreId - The OpenAI vector store ID
   * @returns The vector store file information
   */
  static async addFileToVectorStore(
    fileId: string,
    vectorStoreId: string
  ): Promise<any> {
    try {
      const client = await this.getClient();
      
      console.log(`Adding file ${fileId} to vector store ${vectorStoreId}`);
      
      // Use fetch directly with beta headers since the SDK might not support this yet
      const bearerToken = client.apiKey;
      const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'OpenAI-Beta': 'assistants=v1'
        },
        body: JSON.stringify({
          file_id: fileId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
        console.error(`Error adding file to vector store: ${JSON.stringify(errorData)}`);
        throw new Error(`Failed to add file to vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Parse the response to get the file information
      const fileData = await response.json();
      console.log(`File added to vector store successfully, response:`, fileData);
      
      return fileData;
    } catch (error) {
      console.error("Error adding file to vector store:", error);
      throw error;
    }
  }

  /**
   * Adds multiple files to a vector store in a batch
   * @param fileIds - Array of OpenAI file IDs
   * @param vectorStoreId - The OpenAI vector store ID
   * @returns The batch operation response with file information
   */
  static async addFileBatchToVectorStore(
    fileIds: string[],
    vectorStoreId: string
  ): Promise<any> {
    try {
      const client = await this.getClient();
      
      console.log(`Adding batch of ${fileIds.length} files to vector store ${vectorStoreId}`);
      
      // Use batch endpoint for multiple files
      const bearerToken = client.apiKey;
      const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/file_batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'OpenAI-Beta': 'assistants=v1'
        },
        body: JSON.stringify({
          file_ids: fileIds
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
        console.error(`Error adding file batch to vector store: ${JSON.stringify(errorData)}`);
        throw new Error(`Failed to add file batch to vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      const batchData = await response.json().catch(e => {
        console.error('Failed to parse batch response as JSON:', e);
        throw new Error('Failed to parse response from vector store batch API');
      });
      
      if (!batchData || !batchData.id) {
        console.error('Invalid batch response format from vector store API:', batchData);
        return { status: 'error', message: 'Invalid response from OpenAI' };
      }
      
      console.log(`File batch added to vector store, batch ID: ${batchData.id}, status: ${batchData.status}`);
      
      // If the API returns file_ids, include them in the response
      if (!batchData.file_ids && batchData.files) {
        // Map files to a more consistent format if needed
        batchData.file_ids = batchData.files.map((f: any) => ({
          id: f.id,
          file_id: f.file_id,
          status: f.status,
          created_at: f.created_at,
          usage_bytes: f.usage_bytes
        }));
      }
      
      return batchData;
    } catch (error) {
      console.error("Error adding file batch to vector store:", error);
      throw error;
    }
  }

  /**
   * Gets files from a vector store
   * @param vectorStoreId - The OpenAI vector store ID
   * @returns The files in the vector store
   */
  static async getVectorStoreFiles(vectorStoreId: string): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      console.log(`Fetching files from vector store ${vectorStoreId}`);
      
      if (!vectorStoreId) {
        console.error("Error: Empty vector store ID provided");
        throw new Error("Vector store ID is required");
      }
      
      // Try to get the API key to verify it's available
      const apiKey = client.apiKey;
      if (!apiKey) {
        console.error("Error: No API key available");
        throw new Error("OpenAI API key not available");
      }
      
      // Check what API version is being used
      console.log(`API endpoint URL: https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`);
      
      // Use fetch directly with beta headers since the SDK might not support this yet
      const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
        }
      });
      
      console.log(`Vector store files API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(e => {
          console.error("Failed to parse error response:", e);
          return { message: 'Failed to parse error response' };
        });
        
        console.error(`Error fetching files from vector store: ${JSON.stringify(errorData)}`);
        throw new Error(`Failed to fetch files from vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Try to parse the response with logging
      const responseText = await response.text();
      console.log(`Raw API response: ${responseText.substring(0, 200)}...`); // Show first 200 chars to avoid huge logs
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Failed to parse response from vector store API');
      }
      
      if (!data || !data.data) {
        console.error('Invalid response format from vector store API:', data);
        throw new Error('Invalid response format from vector store API');
      }
      
      console.log(`Files fetched from vector store successfully: ${data.data.length} files`);
      
      return data.data || [];
    } catch (error) {
      console.error("Error fetching files from vector store:", error);
      throw error;
    }
  }

  /**
   * Removes a file from a vector store
   * @param fileId - The OpenAI file ID
   * @param vectorStoreId - The OpenAI vector store ID
   * @returns True if successful
   */
  static async removeFileFromVectorStore(fileId: string, vectorStoreId: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      
      console.log(`Removing file ${fileId} from vector store ${vectorStoreId}`);
      
      // Use fetch directly with beta headers since the SDK might not support this yet
      const bearerToken = client.apiKey;
      const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v1'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
        console.error(`Error removing file from vector store: ${JSON.stringify(errorData)}`);
        throw new Error(`Failed to remove file from vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      console.log(`File removed from vector store successfully`);
      
      return true;
    } catch (error) {
      console.error("Error removing file from vector store:", error);
      throw error;
    }
  }

  /**
   * Deletes a file from OpenAI's files API
   * @param openaiFileId - The OpenAI file ID to delete
   * @returns True if successful, false otherwise
   */
  static async deleteFileFromOpenAI(openaiFileId: string): Promise<boolean> {
    try {
      console.log(`Deleting file ${openaiFileId} from OpenAI files API`);
      
      // Get the OpenAI client
      const client = await this.getClient();
      
      // Delete the file from OpenAI
      await client.files.del(openaiFileId);
      console.log(`Successfully deleted file from OpenAI: ${openaiFileId}`);
      
      return true;
    } catch (error) {
      // Log the error but don't throw it
      console.error(`Error deleting file ${openaiFileId} from OpenAI:`, error);
      logger.error(error, {
        action: 'delete_openai_file',
        openaiFileId
      });
      return false;
    }
  }
} 