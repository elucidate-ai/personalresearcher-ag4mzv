/**
 * API Types and Interfaces
 * Version: 1.0.0
 * 
 * Defines comprehensive TypeScript interfaces and types for API requests, responses,
 * and data structures used in client-server communication.
 */

/**
 * HTTP methods supported by the API
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;

/**
 * API error codes for standardized error handling
 */
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST: 'INVALID_REQUEST'
} as const;

/**
 * Default API configuration settings
 */
export const DEFAULT_API_CONFIG = {
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    backoffFactor: 1.5,
    retryableStatuses: [408, 429, 500, 502, 503, 504]
  }
} as const;

/**
 * Generic API response wrapper interface
 * @template T - Type of the response data
 */
export interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly message: string;
  readonly timestamp: string;
  readonly requestId: string;
}

/**
 * API error interface for standardized error handling
 */
export interface ApiError {
  readonly code: keyof typeof API_ERROR_CODES;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly stack?: string;
  readonly requestId: string;
}

/**
 * Generic paginated response interface
 * @template T - Type of the paginated items
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/**
 * API request configuration interface
 */
export interface ApiRequestConfig {
  readonly headers: Record<string, string>;
  readonly params: Record<string, unknown>;
  readonly timeout: number;
  readonly retryConfig: RetryConfig;
  readonly validateStatus: (status: number) => boolean;
}

/**
 * Retry configuration interface for failed requests
 */
export interface RetryConfig {
  readonly maxRetries: number;
  readonly backoffFactor: number;
  readonly retryableStatuses: readonly number[];
}

/**
 * Supported content types enum
 */
export enum ContentType {
  VIDEO = 'VIDEO',
  ARTICLE = 'ARTICLE',
  PODCAST = 'PODCAST',
  BOOK = 'BOOK'
}

/**
 * Knowledge graph node interface
 */
export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly properties: Record<string, unknown>;
  readonly metadata: NodeMetadata;
}

/**
 * Node metadata interface
 */
export interface NodeMetadata {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/**
 * Knowledge graph relationship interface
 */
export interface GraphRelationship {
  readonly source: string;
  readonly target: string;
  readonly type: string;
  readonly properties: Record<string, unknown>;
  readonly weight: number;
  readonly metadata: RelationshipMetadata;
}

/**
 * Relationship metadata interface
 */
export interface RelationshipMetadata extends NodeMetadata {
  readonly confidence: number;
}

/**
 * Type guard for checking if a response is paginated
 */
export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'total' in response &&
    'page' in response &&
    'size' in response
  );
}

/**
 * Type guard for checking if a response is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'requestId' in error
  );
}

/**
 * Type for API error codes
 */
export type ApiErrorCode = keyof typeof API_ERROR_CODES;

/**
 * Type for HTTP methods
 */
export type HttpMethod = keyof typeof HTTP_METHODS;