/**
 * Password Hashing Utilities
 *
 * Uses bcrypt for secure password hashing with automatic salt generation.
 * This module should be used for all password operations in the application.
 */

import bcrypt from 'bcrypt';

// Cost factor for bcrypt - higher is more secure but slower
// 12 is recommended for production (2^12 = 4096 iterations)
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with automatic salt generation.
 *
 * @param password - The plain text password to hash
 * @returns The hashed password (includes salt)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 *
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash is a valid bcrypt hash.
 * Used to detect legacy SHA-256 hashes that need migration.
 *
 * @param hash - The hash to check
 * @returns True if it's a bcrypt hash
 */
export function isBcryptHash(hash: string): boolean {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
  return /^\$2[aby]?\$\d{1,2}\$/.test(hash);
}
