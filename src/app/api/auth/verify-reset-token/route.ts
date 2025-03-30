import { NextResponse } from "next/server";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset";

export async function GET(request: Request) {
  try {
    // Extract token from the URL
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing reset token' }, 
        { status: 400 }
      );
    }

    // Verify the reset token
    const userId = await verifyPasswordResetToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' }, 
        { status: 400 }
      );
    }

    // Return success response if the token is valid
    return NextResponse.json(
      { 
        valid: true, 
        message: 'Token is valid'
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying the token' }, 
      { status: 500 }
    );
  }
} 