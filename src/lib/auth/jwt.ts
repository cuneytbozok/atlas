import jwt, { SignOptions } from 'jsonwebtoken';

// Define the role type
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// Define the payload structure for our JWT tokens
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Generates a JWT token for a user
 * @param user - The user to generate a token for
 * @returns The generated JWT token
 */
export function generateToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const options: SignOptions = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };

  return jwt.sign(payload, jwtSecret, options);
}

/**
 * Verifies a JWT token and returns the payload
 * @param token - The token to verify
 * @returns The decoded payload if the token is valid
 * @throws Error if the token is invalid
 */
export function verifyToken(token: string): JwtPayload {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
} 