import { prisma } from '@/lib/prisma';

/**
 * Interface for error context data
 */
interface ErrorContext {
  [key: string]: any;
}

/**
 * Logger utility for handling application errors
 */
class Logger {
  /**
   * Log an error to the database
   * @param error - The error to log
   * @param context - Additional context information
   * @returns The created error log record
   */
  async error(error: Error | unknown, context?: ErrorContext) {
    // Extract error details
    const message = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    // Format context as JSON-compatible
    const contextData = context ? this.sanitizeContext(context) : undefined;
    
    try {
      // Log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('ERROR:', message);
        if (stackTrace) console.error(stackTrace);
        if (contextData) console.error('Context:', contextData);
      }
      
      // Log to database
      const errorLog = await prisma.errorLog.create({
        data: {
          message,
          stackTrace,
          context: contextData,
        },
      });
      
      return errorLog;
    } catch (logError) {
      // Fallback to console if database logging fails
      console.error('Failed to log error to database:', logError);
      console.error('Original error:', message);
      return null;
    }
  }
  
  /**
   * Sanitize context data to ensure it's JSON-compatible
   * @param context - The context data to sanitize
   * @returns JSON-compatible object
   */
  private sanitizeContext(context: ErrorContext): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Skip undefined values
      if (value === undefined) continue;
      
      // Handle circular references and functions
      try {
        // Test if value can be stringified
        JSON.stringify(value);
        sanitized[key] = value;
      } catch (e) {
        // If it can't be stringified, convert to string representation
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }
}

// Export a singleton instance
export const logger = new Logger(); 