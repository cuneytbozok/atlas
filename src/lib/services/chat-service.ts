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

      // Get threads for the project that were created by this user
      // We need to first get the activity logs for thread creation
      const threadCreationLogs = await prisma.activityLog.findMany({
        where: {
          userId: userId,
          action: 'CREATE_THREAD',
          entityType: 'THREAD',
        },
        select: {
          entityId: true
        }
      });

      // Extract thread IDs created by this user
      const threadIdsCreatedByUser = threadCreationLogs.map(log => log.entityId);

      console.log(`Found ${threadIdsCreatedByUser.length} threads created by user ${userId} for project ${projectId}`);

      // Get threads for the project that were created by this user
      const threads = await prisma.thread.findMany({
        where: {
          projectId: projectId,
          id: {
            in: threadIdsCreatedByUser
          }
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
      console.log(`Checking run status for thread ${threadId}, run ${runId}`);
      
      const thread = await prisma.thread.findUnique({
        where: { id: threadId },
        include: {
          project: true
        }
      });

      if (!thread?.openaiThreadId) {
        console.error(`Thread ${threadId} does not have an OpenAI thread ID`);
        throw new Error(`Thread ${threadId} does not have an OpenAI thread ID`);
      }

      const client = await this.getClient();

      // Get the run status
      console.log(`Retrieving run ${runId} from OpenAI thread ${thread.openaiThreadId}`);
      const run = await client.beta.threads.runs.retrieve(
        thread.openaiThreadId,
        runId
      );
      console.log(`Run status: ${run.status}`);

      let newMessages: any[] = [];

      // If the run is completed, get any new messages and update token usage
      if (run.status === 'completed') {
        console.log(`Run ${runId} is completed, fetching new messages`);
        
        // Extract token usage from the run
        const usage = run.usage;
        if (usage) {
          console.log(`Run token usage: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
          
          // Find the user message associated with this run
          const userMessage = await prisma.message.findFirst({
            where: {
              threadId,
              role: 'user'
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
          
          if (userMessage) {
            // Since we now have the Prisma client generated with our new schema,
            // we can use type assertions to help TypeScript understand our structure
            await prisma.message.update({
              where: { id: userMessage.id },
              data: {
                // Cast to any to bypass TypeScript errors until Prisma types are regenerated
                runId: runId,
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
              } as any
            });
            console.log(`Updated user message ${userMessage.id} with run token usage`);
          } else {
            console.log(`No matching user message found for run ${runId}`);
          }
          
          // Cast thread to any to access the new fields
          const threadAny = thread as any;
          
          // Update thread token usage (accumulating tokens)
          const threadPromptTokens = threadAny.promptTokens || 0;
          const threadCompletionTokens = threadAny.completionTokens || 0;
          const threadTotalTokens = threadAny.totalTokens || 0;
          
          await prisma.thread.update({
            where: { id: threadId },
            data: {
              updatedAt: new Date(),
              // Cast to any to bypass TypeScript errors until Prisma types are regenerated
              promptTokens: threadPromptTokens + usage.prompt_tokens,
              completionTokens: threadCompletionTokens + usage.completion_tokens,
              totalTokens: threadTotalTokens + usage.total_tokens
            } as any
          });
          console.log(`Updated thread ${threadId} with accumulated token usage`);
          
          // If thread belongs to a project, update project token usage as well
          if (thread.projectId && thread.project) {
            // Cast project to any to access the new fields
            const projectAny = thread.project as any;
            
            const projectPromptTokens = projectAny.promptTokens || 0;
            const projectCompletionTokens = projectAny.completionTokens || 0;
            const projectTotalTokens = projectAny.totalTokens || 0;
            
            await prisma.project.update({
              where: { id: thread.projectId },
              data: {
                // Cast to any to bypass TypeScript errors until Prisma types are regenerated
                promptTokens: projectPromptTokens + usage.prompt_tokens,
                completionTokens: projectCompletionTokens + usage.completion_tokens,
                totalTokens: projectTotalTokens + usage.total_tokens
              } as any
            });
            console.log(`Updated project ${thread.projectId} with accumulated token usage`);
          }
        } else {
          console.log(`No usage information available for run ${runId}`);
        }
        
        // Existing code to handle fetching messages
        const existingMessagesCount = await prisma.message.count({
          where: { threadId }
        });
        
        console.log(`Thread has ${existingMessagesCount} existing messages in DB`);
        
        // Get ALL messages from OpenAI for this thread
        console.log(`Listing ALL messages from OpenAI thread ${thread.openaiThreadId}`);
        const openaiMessages = await client.beta.threads.messages.list(
          thread.openaiThreadId
        );
        
        console.log(`Retrieved ${openaiMessages.data.length} total messages from OpenAI`);

        // Specifically look for the latest assistant message
        const assistantMessages = openaiMessages.data.filter(msg => msg.role === 'assistant');
        console.log(`Found ${assistantMessages.length} assistant messages in the thread`);
        
        if (assistantMessages.length > 0) {
          // Get the latest assistant message
          const latestAssistantMessage = assistantMessages[0]; // Messages are returned in reverse chronological order
          console.log(`Latest assistant message ID: ${latestAssistantMessage.id}`);
          
          // Check if we already have this message
          const existing = await prisma.message.findUnique({
            where: { openaiMessageId: latestAssistantMessage.id }
          });
          
          if (existing) {
            console.log(`Latest assistant message ${latestAssistantMessage.id} already exists in DB (id: ${existing.id})`);
          } else {
            console.log(`Processing new assistant message ${latestAssistantMessage.id}`);
            
            // Extract the content text
            let textContent = '';
            if (latestAssistantMessage.content && latestAssistantMessage.content.length > 0) {
              for (const contentItem of latestAssistantMessage.content) {
                if (contentItem.type === 'text') {
                  textContent += contentItem.text.value + " ";
                }
              }
            }
            
            textContent = textContent.trim();
            console.log(`Extracted content (first 100 chars): ${textContent.substring(0, 100)}...`);
            
            if (textContent) {
              // Create the message in our database
              console.log(`Creating new message in DB for thread ${threadId}`);
              const newMessage = await prisma.message.create({
                data: {
                  threadId,
                  role: 'assistant',
                  content: textContent,
                  openaiMessageId: latestAssistantMessage.id,
                  // Use type assertion for new fields
                  runId
                } as any
              });
              console.log(`Created message in DB with id ${newMessage.id}`);
  
              newMessages.push(newMessage);
            } else {
              console.log(`No text content found in assistant message, skipping`);
            }
          }
        } else {
          console.log(`No assistant messages found in the thread despite run being completed`);
        }
      } else if (run.status === 'requires_action') {
        // Handle function calling if needed
        console.log(`Run requires action - function calling may be needed`);
      }

      console.log(`Returning run status ${run.status} with ${newMessages.length} new messages`);
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