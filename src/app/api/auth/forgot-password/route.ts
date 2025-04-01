import z from 'zod';
import { NextResponse } from 'next/server';
import { generatePasswordResetToken } from '@/lib/auth/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';
import { SettingsService } from "@/lib/services/settings-service";
import { Resend } from 'resend';
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
          // Get email settings
          const emailFrom = await SettingsService.getEmailFrom();
          const emailReplyTo = await SettingsService.getEmailReplyTo();
          const resendApiKey = await SettingsService.getResendApiKey();
          
          if (resendApiKey) {
            // Create Resend client with API key from database
            const resend = new Resend(resendApiKey);
            
            // Set up email configuration
            const from = emailFrom || 'onboarding@resend.dev';
            
            // Generate reset URL
            const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
            const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
            
            // Create a beautiful email template matching Atlas design
            const htmlContent = `
              <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-bottom: 8px;">Reset Your Password</h1>
                  <div style="height: 4px; width: 60px; background-color: #2563eb; margin: 0 auto;"></div>
                </div>
                
                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                  We received a request to reset your password for your ATLAS account. If you didn't request this, you can safely ignore this email.
                </p>
                
                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  To reset your password, click the button below. This link will expire in 1 hour.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; transition: background-color 0.2s;">
                    Reset Password
                  </a>
                </div>
                
                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
                  If the button above doesn't work, copy and paste this URL into your browser:
                </p>
                
                <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; margin-bottom: 24px;">
                  <p style="color: #334155; font-size: 14px; line-height: 1.5; word-break: break-all; margin: 0;">
                    ${resetUrl}
                  </p>
                </div>
                
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px;">
                  <p style="color: #64748b; font-size: 14px; text-align: center;">
                    This email was sent from ATLAS. If you didn't request a password reset, no further action is required.
                  </p>
                </div>
              </div>
            `;
            
            // If this is a development environment, log the reset URL for developer convenience
            if (process.env.NODE_ENV !== 'production') {
              console.log('\n[DEVELOPMENT] Password reset link:', resetUrl);
            }
            
            // Subject with test indicator for non-production environments
            const subject = process.env.NODE_ENV === 'production' 
                          ? "Reset your ATLAS password"
                          : "[TEST] Reset your ATLAS password";
            
            // Send email with the database-stored API key
            try {
              const { error } = await resend.emails.send({
                from,
                to: email,
                ...(emailReplyTo ? { replyTo: emailReplyTo } : {}),
                subject,
                html: htmlContent,
              });
              
              if (error) {
                console.error('Error sending password reset email:', error);
              }
            } catch (error) {
              console.error('Failed to send password reset email:', error);
            }
          } else {
            // Fallback to the original method if no API key is configured in the database
            const { success, error } = await sendPasswordResetEmail(email, token);
            
            if (!success) {
              console.error('Error sending password reset email with fallback method:', error);
            }
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