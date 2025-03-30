import z from 'zod';
import { NextResponse } from 'next/server';
import { generatePasswordResetToken } from '@/lib/auth/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';
import prisma from '@/lib/prisma';

// Define schema for request validation
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    const result = forgotPasswordSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    
    const { email } = result.data;
    
    try {
      // Check if the user exists first
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });
      
      // Only proceed if we found a matching user, but don't reveal this to client
      if (user) {
        // Generate a password reset token
        const token = await generatePasswordResetToken(email);
        
        if (token) {
          // Send the password reset email
          const { success, error } = await sendPasswordResetEmail(email, token);
          
          if (!success) {
            console.error('Error sending password reset email:', error);
          }
        }
      } else {
        // Log that no user was found but don't expose this information
        console.log(`Password reset requested for non-existent email: ${email}`);
      }
      
      // Always return a success response to prevent email enumeration
      return NextResponse.json(
        { message: 'If your email is registered, you will receive a password reset link shortly.' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Password reset process error:', error);
      
      // Always return a success response to prevent email enumeration
      return NextResponse.json(
        { message: 'If your email is registered, you will receive a password reset link shortly.' },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Forgot password route error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 