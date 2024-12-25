/**
 * Authentication Types and Interfaces
 * Version: 1.0.0
 * 
 * Defines comprehensive TypeScript types and interfaces for authentication,
 * user roles, and authorization throughout the web application.
 */

import { ApiResponse } from './api.types';

/**
 * Enumeration of available user roles with strict hierarchy
 */
export enum UserRole {
  ANONYMOUS = 'ANONYMOUS',
  BASIC_USER = 'BASIC_USER',
  PREMIUM_USER = 'PREMIUM_USER',
  CONTENT_MANAGER = 'CONTENT_MANAGER',
  ADMINISTRATOR = 'ADMINISTRATOR'
}

/**
 * Type defining granular permissions for role-based access control
 */
export type AuthPermission = 
  | 'READ_CONTENT'
  | 'WRITE_CONTENT'
  | 'MANAGE_USERS'
  | 'EXPORT_DATA'
  | 'ACCESS_ADMIN'
  | 'MANAGE_ROLES';

/**
 * Interface for authenticated user data with enhanced security tracking
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date;
  readonly mfaEnabled: boolean;
  readonly lastActivityAt: Date;
}

/**
 * Interface for decoded JWT token payload with enhanced security metadata
 */
export interface TokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly aud: string;
  readonly permissions: string[];
  readonly sessionId: string;
  readonly mfaVerified: boolean;
}

/**
 * Type defining comprehensive set of authentication error types
 */
export type AuthErrorType =
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'ACCOUNT_LOCKED'
  | 'UNKNOWN_ERROR';

/**
 * Interface for structured authentication errors
 */
export interface AuthError {
  readonly type: AuthErrorType;
  readonly message: string;
  readonly code: string;
  readonly details: any;
  readonly timestamp: Date;
}

/**
 * Interface defining comprehensive authentication state
 */
export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly error: AuthError | null;
  readonly sessionExpiresAt: Date | null;
}

/**
 * Interface for secure login request payload with MFA support
 */
export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
  readonly mfaCode?: string;
}

/**
 * Interface for comprehensive authentication response with token metadata
 */
export interface AuthResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly user: AuthUser;
  readonly tokenType: string;
}

/**
 * Type alias for authentication API responses
 */
export type AuthApiResponse<T> = ApiResponse<T>;

/**
 * Type guard to check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'code' in error &&
    'timestamp' in error
  );
}

/**
 * Type guard to check if a user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: AuthPermission): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.ANONYMOUS]: 0,
    [UserRole.BASIC_USER]: 1,
    [UserRole.PREMIUM_USER]: 2,
    [UserRole.CONTENT_MANAGER]: 3,
    [UserRole.ADMINISTRATOR]: 4
  };

  const permissionLevels: Record<AuthPermission, number> = {
    'READ_CONTENT': 1,
    'WRITE_CONTENT': 2,
    'EXPORT_DATA': 2,
    'MANAGE_USERS': 3,
    'ACCESS_ADMIN': 4,
    'MANAGE_ROLES': 4
  };

  return roleHierarchy[user.role] >= permissionLevels[permission];
}