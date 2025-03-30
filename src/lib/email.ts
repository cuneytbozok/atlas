import { Resend } from 'resend';

/**
 * Configuration options for email templates
 */
type EmailConfig = {
  from: string;
  replyTo?: string;
  baseUrl: string;
};

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Default configuration
const defaultConfig: EmailConfig = {
  from: 'onboarding@resend.dev', // Use Resend's default sender for free tier
  replyTo: process.env.EMAIL_REPLY_TO,
  baseUrl: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
};

/**
 * General function to send emails via Resend
 * 
 * @param to Recipient email address
 * @param subject Email subject
 * @param htmlContent HTML content of the email
 * @param config Optional configuration overrides
 * @returns Result of the email sending operation
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  htmlContent: string,
  config?: Partial<EmailConfig>
): Promise<{ success: boolean; error?: any }> {
  const { from, replyTo } = { ...defaultConfig, ...config };
  
  try {
    // Always use the actual recipient email address
    const recipient = to;
    
    // Adjust subject to indicate test emails in development
    const emailSubject = process.env.NODE_ENV === 'production' 
                      ? subject 
                      : `[TEST] ${subject}`;
    
    // If this is a test, log email content for development purposes
    if (process.env.NODE_ENV !== 'production') {
      const originalRecipient = Array.isArray(to) ? to.join(', ') : to;
      console.log(`\n[DEVELOPMENT] Email would be sent to: ${originalRecipient}`);
      console.log(`[DEVELOPMENT] Subject: ${subject}`);
    }

    // Send the email using Resend
    const { data, error } = await resend.emails.send({
      from,
      to: recipient,
      replyTo: replyTo,
      subject: emailSubject,
      html: htmlContent,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
}

/**
 * Sends a password reset email
 * 
 * @param email The recipient's email
 * @param resetToken The password reset token
 * @param config Optional config overrides
 * @returns The result of the email sending operation
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  config?: Partial<EmailConfig>
): Promise<{ success: boolean; error?: any }> {
  const { baseUrl } = { ...defaultConfig, ...config };
  const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
  
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

  // Use the general email sending function
  return sendEmail(
    email,
    'Reset your ATLAS password',
    htmlContent,
    config
  );
} 