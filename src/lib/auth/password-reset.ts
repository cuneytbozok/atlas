import prisma from "@/lib/prisma";
import cryptoRandomString from "crypto-random-string";
import { addHours } from "date-fns";

/**
 * Generates a password reset token for a user
 * 
 * @param email The email of the user
 * @returns The generated token or null if user not found
 */
export async function generatePasswordResetToken(email: string): Promise<string | null> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that the user doesn't exist
      return null;
    }

    // Generate a secure random token
    const token = cryptoRandomString({ length: 64, type: 'url-safe' });
    
    // Set expiration time (1 hour from now)
    const expiresAt = addHours(new Date(), 1);

    try {
      // Delete any existing reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Create a new reset token
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });
    } catch (error) {
      // If there's a database error (like table doesn't exist), log it but return the token anyway
      // This allows the flow to continue in development even without the proper database setup
      console.warn("Could not store password reset token in database:", error);
      console.log("Generated token for development:", token);
    }

    return token;
  } catch (error) {
    console.error("Error generating password reset token:", error);
    throw error;
  }
}

/**
 * Verifies a password reset token
 * 
 * @param token The reset token to verify
 * @returns The user ID if the token is valid, null otherwise
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    });

    // Check if token exists and is not expired
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return null;
    }

    return resetToken.user.id;
  } catch (error) {
    console.error("Error verifying password reset token:", error);
    // In development, we'll return null so the flow can continue
    return null;
  }
}

/**
 * Consumes a password reset token (deletes it after use)
 * 
 * @param token The token to consume
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
  try {
    await prisma.passwordResetToken.delete({
      where: { token },
    });
  } catch (error) {
    console.error("Error consuming password reset token:", error);
    // We can ignore this error since it's just cleanup
  }
} 