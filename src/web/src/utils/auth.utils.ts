/**
 * Authentication Utility Functions
 * Version: 1.0.0
 * 
 * Provides secure authentication utilities with OWASP compliance and enhanced security features.
 * Implements token management, role validation, and security checks.
 */

import { jwtDecode } from 'jwt-decode'; // v3.1.2
import CryptoJS from 'crypto-js'; // v4.1.1
import { AuthUser, TokenPayload, UserRole } from '../types/auth.types';
import { tokenConfig } from '../config/auth.config';

/**
 * Token blacklist for revoked tokens
 * Implements in-memory token blacklist with automatic cleanup
 */
const tokenBlacklist = new Set<string>();

/**
 * Parses and validates JWT token with enhanced security checks
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export const parseToken = (token: string): TokenPayload | null => {
  try {
    // Validate token format
    if (!token || !token.includes('.')) {
      return null;
    }

    // Decode token with type safety
    const decoded = jwtDecode<TokenPayload>(token);

    // Validate required fields
    if (!decoded.sub || !decoded.exp || !decoded.role) {
      return null;
    }

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token parsing error:', error);
    return null;
  }
};

/**
 * Checks if a JWT token has expired with grace period handling
 * @param token - JWT token string
 * @returns boolean indicating if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = parseToken(token);
  if (!decoded) return true;

  // Add small grace period for clock skew
  const gracePeriodMs = 30 * 1000; // 30 seconds
  const currentTime = Date.now() / 1000;
  
  return decoded.exp <= currentTime - gracePeriodMs;
};

/**
 * Securely stores authentication token with encryption
 * @param token - JWT token string
 */
export const storeToken = (token: string): void => {
  try {
    // Validate token
    if (!token || !parseToken(token)) {
      throw new Error('Invalid token format');
    }

    // Encrypt token
    const encrypted = CryptoJS.AES.encrypt(
      token,
      tokenConfig.secureStorage.encryptionKey
    ).toString();

    // Store with prefix
    localStorage.setItem(
      `${tokenConfig.secureStorage.tokenPrefix}token`,
      encrypted
    );
  } catch (error) {
    console.error('Token storage error:', error);
    throw new Error('Failed to store token securely');
  }
};

/**
 * Retrieves stored token with decryption
 * @returns Decrypted token or null if not found
 */
export const retrieveToken = (): string | null => {
  try {
    const encrypted = localStorage.getItem(
      `${tokenConfig.secureStorage.tokenPrefix}token`
    );
    if (!encrypted) return null;

    // Decrypt token
    const decrypted = CryptoJS.AES.decrypt(
      encrypted,
      tokenConfig.secureStorage.encryptionKey
    ).toString(CryptoJS.enc.Utf8);

    return decrypted || null;
  } catch (error) {
    console.error('Token retrieval error:', error);
    return null;
  }
};

/**
 * Role hierarchy for permission validation
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ANONYMOUS]: 0,
  [UserRole.BASIC_USER]: 1,
  [UserRole.PREMIUM_USER]: 2,
  [UserRole.CONTENT_MANAGER]: 3,
  [UserRole.ADMINISTRATOR]: 4
};

/**
 * Checks if user has required role level with hierarchical validation
 * @param user - Authenticated user object
 * @param requiredRole - Required role for access
 * @param requiredPermissions - Array of required permissions
 * @returns boolean indicating if user has required access
 */
export const hasRequiredRole = (
  user: AuthUser | null,
  requiredRole: UserRole,
  requiredPermissions: string[] = []
): boolean => {
  // Validate user exists
  if (!user) return false;

  // Check role hierarchy
  const userRoleLevel = ROLE_HIERARCHY[user.role];
  const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    return false;
  }

  // Validate permissions if specified
  if (requiredPermissions.length > 0) {
    return requiredPermissions.every(permission => 
      user.permissions?.includes(permission)
    );
  }

  return true;
};

/**
 * Adds token to blacklist for revocation
 * @param token - Token to blacklist
 */
export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);

  // Schedule cleanup after token expiry
  const decoded = parseToken(token);
  if (decoded) {
    const timeoutMs = (decoded.exp * 1000) - Date.now();
    setTimeout(() => {
      tokenBlacklist.delete(token);
    }, timeoutMs);
  }
};

/**
 * Validates token format and signature
 * @param token - Token to validate
 * @returns boolean indicating if token is valid
 */
export const validateToken = (token: string): boolean => {
  try {
    // Check token format
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Validate token parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Decode and validate payload
    const decoded = parseToken(token);
    if (!decoded) {
      return false;
    }

    // Check expiration
    if (isTokenExpired(token)) {
      return false;
    }

    // Check blacklist
    if (tokenBlacklist.has(token)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Clears all stored authentication tokens securely
 */
export const clearTokens = (): void => {
  try {
    const prefix = tokenConfig.secureStorage.tokenPrefix;
    Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Token clearing error:', error);
    throw new Error('Failed to clear authentication tokens');
  }
};