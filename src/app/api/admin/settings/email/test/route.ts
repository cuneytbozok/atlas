import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { SettingsService } from "@/lib/services/settings-service";
import { withErrorHandling } from "@/lib/api/error-handler";
import { withPermission } from "@/lib/middleware/with-permission";
import { Resend } from 'resend';
import { z } from "zod";

// Schema for test email recipient
const testEmailSchema = z.object({
  testEmail: z.string().email("Invalid email format"),
});

// POST - Send test email
const handleSendTestEmail = async (request: Request) => {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Validate request data
    const data = await request.json();
    const result = testEmailSchema.safeParse(data);
    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.format() },
        { status: 400 }
      );
    }
    
    const { testEmail } = result.data;
    
    // Get email settings
    const emailFrom = await SettingsService.getEmailFrom();
    const emailReplyTo = await SettingsService.getEmailReplyTo();
    const resendApiKey = await SettingsService.getResendApiKey();
    
    if (!resendApiKey) {
      return NextResponse.json(
        { message: "Resend API key is not configured" },
        { status: 400 }
      );
    }
    
    // Create test email HTML content
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h1 style="color: #333;">Test Email</h1>
        <p>This is a test email from your Atlas application to confirm that email sending is working correctly.</p>
        <p>If you received this, your email configuration is set up properly!</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 14px;">
          Sent from Atlas platform at ${new Date().toISOString()}
        </p>
      </div>
    `;
    
    // Initialize Resend with the retrieved API key
    const resend = new Resend(resendApiKey);
    
    // Set up email configuration
    const from = emailFrom || 'onboarding@resend.dev';
    const replyTo = emailReplyTo;
    const subject = process.env.NODE_ENV === 'production' 
                  ? "Atlas Test Email" 
                  : "[TEST] Atlas Test Email";
    
    try {
      // Send email directly with Resend client
      const { data, error } = await resend.emails.send({
        from,
        to: testEmail,
        ...(replyTo ? { replyTo } : {}),
        subject,
        html: htmlContent,
      });
      
      if (error) {
        console.error("Failed to send email:", error);
        return NextResponse.json(
          { message: "Failed to send test email", error },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        message: "Test email sent successfully",
        recipient: testEmail
      });
    } catch (error) {
      console.error("Error sending email:", error);
      return NextResponse.json(
        { message: "Failed to send test email", error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in handleSendTestEmail:", error);
    throw error; // Let the error middleware handle it
  }
};

// Export the handler function with permission middleware
export const POST = withErrorHandling(
  withPermission(handleSendTestEmail, { requiredRole: "ADMIN" })
); 