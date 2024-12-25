/**
 * API Configuration
 * @version 1.0.0
 * @description Centralized API configuration file that defines API endpoints, base URLs,
 * timeouts, retry policies, security headers, and comprehensive API-related settings
 * for the web application's communication with backend services.
 */

import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Interface defining comprehensive API configuration properties
 */
interface ApiConfig {
  baseUrl: string;
  endpoints: typeof API_ENDPOINTS;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    delay: number;
    backoffFactor: number;
    retryableStatuses: number[];
    retryCondition: (error: any) => boolean;
  };
  headers: {
    contentType: string;
    accept: string;
    xRequestId: string;
    xApiVersion: string;
    xClientId: string;
  };
  security: {
    cors: {
      allowedOrigins: string[];
      allowedMethods: string[];
      allowedHeaders: string[];
      maxAge: number;
    };
    rateLimit: {
      maxRequests: number;
      windowMs: number;
    };
    csrf: {
      enabled: boolean;
      cookieName: string;
    };
  };
  validation: {
    maxPayloadSize: number;
    allowedContentTypes: string[];
    urlParameterValidation: boolean;
  };
  monitoring: {
    enableRequestLogging: boolean;
    enableMetrics: boolean;
    enableTracing: boolean;
    samplingRate: number;
  };
}

// Global constants
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const MAX_PAYLOAD_SIZE = 10485760; // 10MB
const API_VERSION = process.env.VITE_API_VERSION || 'v1';

/**
 * Generate a unique request ID for tracking
 * @returns Unique request ID string
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Comprehensive API configuration object
 */
export const apiConfig: ApiConfig = {
  baseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  timeout: API_TIMEOUT,
  retryPolicy: {
    maxRetries: MAX_RETRIES,
    delay: RETRY_DELAY,
    backoffFactor: 1.5,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryCondition: (error) => error.isRetryable || error.isNetworkError
  },
  headers: {
    contentType: 'application/json',
    accept: 'application/json',
    xRequestId: generateRequestId(),
    xApiVersion: API_VERSION,
    xClientId: process.env.VITE_CLIENT_ID as string
  },
  security: {
    cors: {
      allowedOrigins: process.env.VITE_ALLOWED_ORIGINS?.split(',') || [],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-API-Version'
      ],
      maxAge: 86400 // 24 hours
    },
    rateLimit: {
      maxRequests: 1000,
      windowMs: 60000 // 1 minute
    },
    csrf: {
      enabled: true,
      cookieName: 'XSRF-TOKEN'
    }
  },
  validation: {
    maxPayloadSize: MAX_PAYLOAD_SIZE,
    allowedContentTypes: ['application/json', 'multipart/form-data'],
    urlParameterValidation: true
  },
  monitoring: {
    enableRequestLogging: true,
    enableMetrics: true,
    enableTracing: true,
    samplingRate: 0.1 // 10% sampling rate
  }
};

// Freeze the configuration object to prevent modifications
Object.freeze(apiConfig);