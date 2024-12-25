/**
 * Core application configuration file that defines global settings,
 * environment variables, application-wide configuration parameters,
 * and security protocols for the web application.
 * @version 1.0.0
 */

import { CONTENT_TYPES, EXPORT_FORMATS } from '../constants/app.constants';

/**
 * Core application settings interface
 */
interface AppConfig {
  name: string;
  version: string;
  environment: string;
  debug: boolean;
  securityLevel: string;
}

/**
 * API-related settings interface including security protocols
 */
interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimitPerMinute: number;
  securityHeaders: SecurityHeadersConfig;
  tokenConfig: TokenConfig;
  corsConfig: CorsConfig;
}

/**
 * Security headers configuration interface
 */
interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: string;
}

/**
 * JWT token configuration interface
 */
interface TokenConfig {
  refreshInterval: number;
  expiryTime: number;
  algorithm: string;
}

/**
 * CORS configuration interface
 */
interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
}

/**
 * Content handling settings interface
 */
interface ContentConfig {
  supportedTypes: CONTENT_TYPES[];
  maxSearchResults: number;
  defaultPageSize: number;
  minSearchChars: number;
}

/**
 * Export functionality settings interface
 */
interface ExportConfig {
  supportedFormats: EXPORT_FORMATS[];
  maxExportSize: number;
  defaultFormat: EXPORT_FORMATS;
}

/**
 * Main application configuration object
 * Contains all core settings, security configurations, and feature parameters
 */
export const appConfig = {
  app: {
    name: process.env.VITE_APP_NAME || 'Knowledge Curator',
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    debug: process.env.NODE_ENV !== 'production',
    securityLevel: process.env.VITE_SECURITY_LEVEL || 'high'
  } as AppConfig,

  api: {
    baseUrl: process.env.VITE_API_BASE_URL,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    rateLimitPerMinute: 1000,
    securityHeaders: {
      // OWASP recommended security headers
      contentSecurityPolicy: "default-src 'self'",
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=()'
    },
    tokenConfig: {
      refreshInterval: 300000, // 5 minutes
      expiryTime: 3600000, // 1 hour
      algorithm: 'RS256'
    },
    corsConfig: {
      allowedOrigins: process.env.VITE_ALLOWED_ORIGINS?.split(',') || [],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 7200 // 2 hours
    }
  } as ApiConfig,

  content: {
    supportedTypes: [
      CONTENT_TYPES.VIDEO,
      CONTENT_TYPES.ARTICLE,
      CONTENT_TYPES.PODCAST,
      CONTENT_TYPES.BOOK
    ],
    maxSearchResults: 100,
    defaultPageSize: 20,
    minSearchChars: 3
  } as ContentConfig,

  export: {
    supportedFormats: [
      EXPORT_FORMATS.NOTION,
      EXPORT_FORMATS.MARKDOWN,
      EXPORT_FORMATS.PDF
    ],
    maxExportSize: 1000,
    defaultFormat: EXPORT_FORMATS.MARKDOWN
  } as ExportConfig
} as const;