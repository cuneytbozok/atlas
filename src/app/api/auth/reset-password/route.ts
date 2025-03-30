import z from 'zod';
import { NextResponse } from 'next/server';
import { verifyPasswordResetToken, consumePasswordResetToken } from '@/lib/auth/password-reset';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

// Define schema for request validation
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters long")
});

export async function POST(req: Request) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    const result = resetPasswordSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.format() }, 
        { status: 400 }
      );
    }
    
    const { token, password } = result.data;
    
    // Verify the reset token
    const userId = await verifyPasswordResetToken(token);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' }, 
        { status: 400 }
      );
    }
    
    try {
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password
      await prisma.user.update({
        where: { id: userId },
        data: { 
          password: hashedPassword,
        },
      });
      
      // Consume (delete) the reset token so it can't be used again
      await consumePasswordResetToken(token);
      
      return NextResponse.json(
        { message: 'Password has been reset successfully' }, 
        { status: 200 }
      );
    } catch (error) {
      console.error('Error updating password:', error);
      return NextResponse.json(
        { error: 'Failed to update password' }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Reset password route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 