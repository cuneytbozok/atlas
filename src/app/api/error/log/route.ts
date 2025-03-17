import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

/**
 * API endpoint for client-side error logging
 */
export async function POST(request: Request) {
  try {
    // Get user information if available
    const session = await getServerSession(authOptions);
    const user = session?.user;
    
    // Parse error data from request
    const errorData = await request.json();
    
    // Add user information to the context if available
    const context = {
      ...errorData,
      source: 'client',
      userId: user?.id,
      userEmail: user?.email,
    };
    
    // Create error object
    const error = new Error(errorData.message || 'Client-side error');
    if (errorData.stack) {
      error.stack = errorData.stack;
    }
    
    // Log the error
    await logger.error(error, context);
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle errors in the error logger itself
    console.error('Error logging client-side error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to log error' },
      { status: 500 }
    );
  }
} 