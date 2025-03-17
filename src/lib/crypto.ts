import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

// Use environment variable for the encryption key, or generate a fallback
// In production, ENCRYPTION_KEY should be set in the environment variables
const encryptionKey = process.env.ENCRYPTION_KEY || 'atlas-default-encryption-key-change-in-prod';

/**
 * Encrypts sensitive data
 * @param text - The text to encrypt
 * @returns The encrypted data as a string
 */
export async function encrypt(text: string): Promise<string> {
  try {
    // Generate a random initialization vector
    const iv = randomBytes(16);
    
    // Use scrypt to derive a key from our encryption key
    const key = await promisify(scrypt)(encryptionKey, 'salt', 32) as Buffer;
    
    // Create cipher
    const cipher = createCipheriv('aes-256-ctr', key, iv);
    
    // Encrypt data
    const encryptedText = Buffer.concat([
      cipher.update(text, 'utf-8'),
      cipher.final()
    ]);
    
    // Return IV + encrypted data as a combined string
    return `${iv.toString('hex')}:${encryptedText.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts encrypted data
 * @param encryptedText - The text to decrypt (in the format iv:encrypted)
 * @returns The decrypted text
 */
export async function decrypt(encryptedText: string): Promise<string> {
  try {
    // Split the IV from the encrypted data
    const [ivHex, encryptedDataHex] = encryptedText.split(':');
    if (!ivHex || !encryptedDataHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');
    
    // Use scrypt to derive a key from our encryption key
    const key = await promisify(scrypt)(encryptionKey, 'salt', 32) as Buffer;
    
    // Create decipher
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    
    // Decrypt data
    const decryptedText = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return decryptedText.toString('utf-8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
} 