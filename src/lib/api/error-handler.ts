import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type ApiHandler = (
  request: Request,
  context: { params: Record<string, string> }
) => Promise<Response>;

/**
 * Wraps an API route handler with error logging and consistent error responses
 * @param handler - The API route handler
 * @returns A wrapped handler with error handling
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (request: Request, context: { params: Record<string, string> }) => {
    try {
      // Call the original handler
      return await handler(request, context);
    } catch (error) {
      // Log the error
      const requestUrl = request.url;
      const method = request.method;
      const { params } = context;
      
      await logger.error(error, {
        type: 'api_error',
        url: requestUrl,
        method,
        params,
      });
      
      // Return appropriate error response
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      const status = getErrorStatusCode(error);
      
      return NextResponse.json({ message, error: true }, { status });
    }
  };
}

/**
 * Determines the appropriate HTTP status code based on the error
 * @param error - The error to analyze
 * @returns HTTP status code
 */
function getErrorStatusCode(error: unknown): number {
  // Default to 500 (Internal Server Error)
  let statusCode = 500;
  
  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();
    
    // Handle common error types
    if (errorName === 'validationerror' || errorMessage.includes('validation')) {
      statusCode = 400; // Bad Request
    } else if (errorMessage.includes('not found') || errorName.includes('notfound')) {
      statusCode = 404; // Not Found
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('unauthenticated')) {
      statusCode = 401; // Unauthorized
    } else if (errorMessage.includes('forbidden') || errorMessage.includes('permission denied')) {
      statusCode = 403; // Forbidden
    }
  }
  
  return statusCode;
} 