/**
 * Authentication and Authorization Constants
 * Defines core authentication/authorization enums and constants with strict TypeScript typing
 * @version 1.0.0
 */

/**
 * Enum defining available user roles for authorization
 * Maps to authorization matrix defined in system specification
 */
export enum AUTH_ROLES {
  ANONYMOUS = 'anonymous',
  BASIC_USER = 'basic_user', 
  PREMIUM_USER = 'premium_user',
  CONTENT_MANAGER = 'content_manager',
  ADMINISTRATOR = 'administrator'
}

/**
 * Enum defining authentication states for managing auth flow
 * Used for tracking authentication lifecycle
 */
export enum AUTH_STATES {
  LOADING = 'loading',
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  ERROR = 'error'
}

/**
 * Enum defining authentication error types
 * Used for standardized error handling across auth flows
 */
export enum AUTH_ERRORS {
  INVALID_CREDENTIALS = 'invalid_credentials',
  SESSION_EXPIRED = 'session_expired',
  UNAUTHORIZED = 'unauthorized',
  NETWORK_ERROR = 'network_error'
}

/**
 * Constant defining granular permissions for role-based access control
 * Implements authorization matrix with strict typing and immutability
 */
export const AUTH_PERMISSIONS = {
  CONTENT_ACCESS: {
    READ: 'content:read',
    WRITE: 'content:write',
    DELETE: 'content:delete'
  },
  VECTOR_OPERATIONS: {
    BASIC_SEARCH: 'vector:basic_search',
    ADVANCED_SEARCH: 'vector:advanced_search',
    FULL_ACCESS: 'vector:full_access'
  },
  KNOWLEDGE_GRAPH: {
    VIEW: 'graph:view',
    NAVIGATE: 'graph:navigate',
    MODIFY: 'graph:modify'
  },
  EXPORT: {
    BASIC_FORMATS: 'export:basic',
    ALL_FORMATS: 'export:all'
  },
  ADMIN: {
    CONTENT_MANAGEMENT: 'admin:content',
    USER_MANAGEMENT: 'admin:users',
    SYSTEM_MANAGEMENT: 'admin:system',
    FULL_ACCESS: 'admin:all'
  }
} as const;

/**
 * Type definitions for AUTH_PERMISSIONS to ensure type safety
 */
export type ContentAccessPermissions = typeof AUTH_PERMISSIONS.CONTENT_ACCESS;
export type VectorOperationsPermissions = typeof AUTH_PERMISSIONS.VECTOR_OPERATIONS;
export type KnowledgeGraphPermissions = typeof AUTH_PERMISSIONS.KNOWLEDGE_GRAPH;
export type ExportPermissions = typeof AUTH_PERMISSIONS.EXPORT;
export type AdminPermissions = typeof AUTH_PERMISSIONS.ADMIN;

/**
 * Constant defining secure storage keys for authentication tokens
 * Used for consistent token management across the application
 */
export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  ID_TOKEN: 'auth_id_token'
} as const;

/**
 * Type definition for TOKEN_STORAGE_KEYS to ensure type safety
 */
export type TokenStorageKeys = typeof TOKEN_STORAGE_KEYS;

/**
 * Type guard to check if a string is a valid AUTH_ROLE
 */
export const isValidAuthRole = (role: string): role is AUTH_ROLES => {
  return Object.values(AUTH_ROLES).includes(role as AUTH_ROLES);
};

/**
 * Type guard to check if a string is a valid AUTH_STATE
 */
export const isValidAuthState = (state: string): state is AUTH_STATES => {
  return Object.values(AUTH_STATES).includes(state as AUTH_STATES);
};

/**
 * Type guard to check if a string is a valid AUTH_ERROR
 */
export const isValidAuthError = (error: string): error is AUTH_ERRORS => {
  return Object.values(AUTH_ERRORS).includes(error as AUTH_ERRORS);
};