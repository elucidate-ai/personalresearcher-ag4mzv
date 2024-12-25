/**
 * API Constants
 * @version 1.0.0
 * @description Centralized TypeScript constants defining API endpoints, routes, versions and HTTP methods
 * for the web application's communication with backend microservices.
 */

/**
 * Type definition for HTTP methods supported by the API
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Interface defining the structure of API endpoints for type safety
 */
export interface ApiEndpoints {
  AUTH: Record<string, string>;
  CONTENT: Record<string, string>;
  GRAPH: Record<string, string>;
  EXPORT: Record<string, string>;
  TOPIC: Record<string, string>;
}

/**
 * API version constants
 */
export const API_VERSIONS = {
  V1: 'v1'
} as const;

/**
 * HTTP method constants for API requests
 */
export const HTTP_METHODS: Record<string, HttpMethod> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;

/**
 * Comprehensive API endpoint constants for all microservices
 */
export const API_ENDPOINTS: ApiEndpoints = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    VERIFY: '/auth/verify',
    RESET_PASSWORD: '/auth/reset-password',
    UPDATE_PROFILE: '/auth/profile/update'
  },
  CONTENT: {
    SEARCH: '/content/search',
    GET: '/content/:id',
    ANALYZE: '/content/:id/analyze',
    QUALITY: '/content/:id/quality',
    METADATA: '/content/:id/metadata',
    SOURCES: '/content/sources',
    VALIDATE: '/content/:id/validate',
    FEEDBACK: '/content/:id/feedback'
  },
  GRAPH: {
    GENERATE: '/graph/generate',
    GET: '/graph/:id',
    UPDATE: '/graph/:id',
    RELATIONSHIPS: '/graph/:id/relationships',
    NODES: '/graph/:id/nodes',
    METRICS: '/graph/:id/metrics',
    VISUALIZE: '/graph/:id/visualize',
    EXPORT: '/graph/:id/export',
    SIMILARITY: '/graph/:id/similarity'
  },
  EXPORT: {
    GENERATE: '/export/generate',
    STATUS: '/export/:id/status',
    DOWNLOAD: '/export/:id/download',
    FORMATS: '/export/formats',
    TEMPLATES: '/export/templates',
    PREVIEW: '/export/:id/preview',
    SETTINGS: '/export/settings',
    HISTORY: '/export/history'
  },
  TOPIC: {
    SEARCH: '/topic/search',
    GET: '/topic/:id',
    RELATED: '/topic/:id/related',
    SUGGESTED: '/topic/suggested',
    TRENDING: '/topic/trending',
    CATEGORIES: '/topic/categories',
    HIERARCHY: '/topic/:id/hierarchy',
    METADATA: '/topic/:id/metadata'
  }
} as const;

/**
 * Helper function to build full API URLs with version
 * @param endpoint - The API endpoint path
 * @returns Full API URL with version
 */
export const buildApiUrl = (endpoint: string): string => {
  return `/${API_VERSIONS.V1}${endpoint}`;
};

/**
 * Helper function to replace URL parameters
 * @param url - The URL with parameters
 * @param params - The parameters to replace
 * @returns URL with replaced parameters
 */
export const replaceUrlParams = (url: string, params: Record<string, string>): string => {
  let finalUrl = url;
  Object.entries(params).forEach(([key, value]) => {
    finalUrl = finalUrl.replace(`:${key}`, value);
  });
  return finalUrl;
};

// Freeze objects to prevent modifications
Object.freeze(API_VERSIONS);
Object.freeze(HTTP_METHODS);
Object.freeze(API_ENDPOINTS);