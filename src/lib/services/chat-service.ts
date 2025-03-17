import { prisma } from '@/lib/prisma';
import { AIService } from './ai-service';
import { SettingsService } from './settings-service';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import 'server-only';

/**
 * Service for managing chat functionality (threads, messages)
 */
export class ChatService {
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
   * Creates a new thread for a project
   * @param projectId - ID of the project
   * @param userId - ID of the user creating the thread
   * @param title - Optional title for the thread
   * @returns The created thread
   */
  static async createThread(
    projectId: string,
    userId: string,
    title?: string
  ) {
    try {
      // Get the project to retrieve assistant information
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          assistant: true
        }
      });

      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      if (!project.assistantId || !project.assistant?.openaiAssistantId) {
        throw new Error(`Project ${projectId} does not have an associated assistant`);
      }

      const client = await this.getClient();

      // Create thread in OpenAI
      console.log(`Creating OpenAI thread for project ${projectId}`);
      const openaiThread = await client.beta.threads.create();
      console.log(`OpenAI thread created: ${openaiThread.id}`);

      // Create thread in our database
      const thread = await prisma.thread.create({
        data: {
          projectId: projectId,
          assistantId: project.assistantId,
          openaiThreadId: openaiThread.id,
          title: title || `Thread ${new Date().toLocaleString()}`,
        }
      });

      // Log the activity
      await prisma.activityLog.create({
        data: {
          userId: userId,
          action: 'CREATE_THREAD',
          entityType: 'THREAD',
          entityId: thread.id
        }
      });

      return thread;
    } catch (error) {
      console.error(`Error creating thread for project ${projectId}:`, error);
      logger.error(error, {
        action: 'create_thread',
        projectId
      });
      throw error;
    }
  }

  /**
   * Gets a list of threads for a project
   * @param projectId - ID of the project
   * @param userId - ID of the user making the request
   * @returns List of threads
   */
  static async getThreads(projectId: string, userId: string) {
    try {
      // Check if user has access to the project
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId
          }
        }
      });

      const isCreator = await prisma.project.count({
        where: {
          id: projectId,
          createdById: userId
        }
      });

      if (!membership && !isCreator) {
        throw new Error('You do not have access to this project');
      }

      // Get threads for the project
      const threads = await prisma.thread.findMany({
        where: {
          projectId: projectId
        },
        orderBy: {
          updatedAt: 'desc'
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1  // Get just the last message for preview
          }
        }
      });

      return threads;
    } catch (error) {
      console.error(`Error fetching threads for project ${projectId}:`, error);
      logger.error(error, {
        action: 'get_threads',
        projectId
      });
      throw error;
    }
  }

  /**
   * Gets a specific thread with all its messages
   * @param threadId - ID of the thread
   * @param userId - ID of the user making the request
   * @returns The thread with its messages
   */
  static async getThread(threadId: string, userId: string) {
    try {
      // Get the thread and check project access
      const thread = await prisma.thread.findUnique({
        where: { id: threadId },
        include: {
          project: true,
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });

      if (!thread) {
        throw new Error(`Thread with ID ${threadId} not found`);
      }

      if (thread.project) {
        // Check if user has access to the project
        const membership = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: thread.project.id,
              userId
            }
          }
        });

        const isCreator = thread.project.createdById === userId;

        if (!membership && !isCreator) {
          throw new Error('You do not have access to this project');
        }
      }

      return thread;
    } catch (error) {
      console.error(`Error fetching thread ${threadId}:`, error);
      logger.error(error, {
        action: 'get_thread',
        threadId
      });
      throw error;
    }
  }

  /**
   * Sends a message to a thread and processes it with the assistant
   * @param threadId - ID of the thread
   * @param userId - ID of the user sending the message
   * @param content - Content of the message
   * @returns The created message and run information
   */
  static async sendMessage(threadId: string, userId: string, content: string) {
    try {
      // Get the thread to verify access and get OpenAI IDs
      const thread = await prisma.thread.findUnique({
        where: { id: threadId },
        include: {
          project: true,
          assistant: true
        }
      });

      if (!thread) {
        throw new Error(`Thread with ID ${threadId} not found`);
      }

      if (thread.project) {
        // Check if user has access to the project
        const membership = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: thread.project.id,
              userId
            }
          }
        });

        const isCreator = thread.project.createdById === userId;

        if (!membership && !isCreator) {
          throw new Error('You do not have access to this project');
        }
      }

      if (!thread.openaiThreadId) {
        throw new Error(`Thread ${threadId} does not have an OpenAI thread ID`);
      }

      if (!thread.assistant?.openaiAssistantId) {
        throw new Error(`Thread ${threadId} does not have an associated OpenAI assistant`);
      }

      const client = await this.getClient();

      // Create message in OpenAI
      console.log(`Creating OpenAI message for thread ${threadId}`);
      const openaiMessage = await client.beta.threads.messages.create(
        thread.openaiThreadId,
        {
          role: "user",
          content: content
        }
      );
      console.log(`OpenAI message created: ${openaiMessage.id}`);

      // Create message in our database
      const message = await prisma.message.create({
        data: {
          threadId: threadId,
          role: "user",
          content: content,
          openaiMessageId: openaiMessage.id
        }
      });

      // Run the assistant on the thread
      console.log(`Running assistant ${thread.assistant.openaiAssistantId} on thread ${thread.openaiThreadId}`);
      const run = await client.beta.threads.runs.create(
        thread.openaiThreadId,
        {
          assistant_id: thread.assistant.openaiAssistantId
        }
      );
      console.log(`Run created: ${run.id}`);

      // Update the thread's updatedAt
      await prisma.thread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() }
      });

      return {
        message,
        run: {
          id: run.id,
          status: run.status
        }
      };
    } catch (error) {
      console.error(`Error sending message to thread ${threadId}:`, error);
      logger.error(error, {
        action: 'send_message',
        threadId
      });
      throw error;
    }
  }

  /**
   * Checks the status of a run
   * @param threadId - ID of the thread
   * @param runId - ID of the run
   * @returns The run status and any new messages
   */
  static async checkRunStatus(threadId: string, runId: string) {
    try {
      const thread = await prisma.thread.findUnique({
        where: { id: threadId }
      });

      if (!thread?.openaiThreadId) {
        throw new Error(`Thread ${threadId} does not have an OpenAI thread ID`);
      }

      const client = await this.getClient();

      // Get the run status
      const run = await client.beta.threads.runs.retrieve(
        thread.openaiThreadId,
        runId
      );

      let newMessages: any[] = [];

      // If the run is completed, get any new messages
      if (run.status === 'completed') {
        // Get the last message we have
        const lastMessage = await prisma.message.findFirst({
          where: {
            threadId,
            role: 'assistant'
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        // Get messages from OpenAI, possibly filtered to only get new ones
        const openaiMessages = await client.beta.threads.messages.list(
          thread.openaiThreadId,
          lastMessage?.openaiMessageId ? 
          { after: lastMessage.openaiMessageId } : 
          undefined
        );

        // Process and store new assistant messages
        for (const oaiMessage of openaiMessages.data) {
          // Skip if it's not from the assistant
          if (oaiMessage.role !== 'assistant') continue;

          // Skip if we already have this message
          const existing = await prisma.message.findUnique({
            where: { openaiMessageId: oaiMessage.id }
          });
          if (existing) continue;

          // Extract the content text
          let textContent = '';
          if (oaiMessage.content && oaiMessage.content.length > 0) {
            for (const contentItem of oaiMessage.content) {
              if (contentItem.type === 'text') {
                textContent += contentItem.text.value + " ";
              }
            }
          }

          // Create the message in our database
          const newMessage = await prisma.message.create({
            data: {
              threadId,
              role: 'assistant',
              content: textContent.trim(),
              openaiMessageId: oaiMessage.id
            }
          });

          newMessages.push(newMessage);
        }

        // Update thread's updatedAt if we added messages
        if (newMessages.length > 0) {
          await prisma.thread.update({
            where: { id: threadId },
            data: { updatedAt: new Date() }
          });
        }
      }

      return {
        status: run.status,
        messages: newMessages
      };
    } catch (error) {
      console.error(`Error checking run status for thread ${threadId}, run ${runId}:`, error);
      logger.error(error, {
        action: 'check_run_status',
        threadId,
        runId
      });
      throw error;
    }
  }

  /**
   * Renames a thread
   * @param threadId - ID of the thread
   * @param userId - ID of the user making the change
   * @param title - New title for the thread
   * @returns The updated thread
   */
  static async renameThread(threadId: string, userId: string, title: string) {
    try {
      // Check access
      const thread = await this.getThread(threadId, userId);

      // Update the title
      const updatedThread = await prisma.thread.update({
        where: { id: threadId },
        data: { title }
      });

      return updatedThread;
    } catch (error) {
      console.error(`Error renaming thread ${threadId}:`, error);
      logger.error(error, {
        action: 'rename_thread',
        threadId
      });
      throw error;
    }
  }

  /**
   * Deletes a thread
   * @param threadId - ID of the thread
   * @param userId - ID of the user making the change
   * @returns True if successful
   */
  static async deleteThread(threadId: string, userId: string) {
    try {
      // Check access
      const thread = await this.getThread(threadId, userId);

      // Delete the thread from OpenAI if it has an OpenAI thread ID
      if (thread.openaiThreadId) {
        try {
          const client = await this.getClient();
          await client.beta.threads.del(thread.openaiThreadId);
          console.log(`OpenAI thread ${thread.openaiThreadId} deleted`);
        } catch (openaiError) {
          console.error(`Error deleting OpenAI thread ${thread.openaiThreadId}:`, openaiError);
          // Continue with the deletion even if OpenAI deletion fails
        }
      }

      // Delete the thread from our database (this will cascade delete messages)
      await prisma.thread.delete({
        where: { id: threadId }
      });

      return true;
    } catch (error) {
      console.error(`Error deleting thread ${threadId}:`, error);
      logger.error(error, {
        action: 'delete_thread',
        threadId
      });
      throw error;
    }
  }
} 