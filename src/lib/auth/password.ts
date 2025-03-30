import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt
 * 
 * @param password The plain text password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12); // 12 rounds is a good balance of security and performance
  return bcrypt.hash(password, salt);
}

/**
 * Compare a password with a hash
 * 
 * @param password The plain text password to check
 * @param hashedPassword The hashed password to compare against
 * @returns True if the password matches the hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Checks if a password meets complexity requirements
 * 
 * @param password The password to validate
 * @returns An object with the result and any errors
 */
export function validatePasswordComplexity(password: string): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 