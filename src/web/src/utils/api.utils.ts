/**
 * API Utilities
 * @version 1.0.0
 * @description Comprehensive utility functions for handling API requests, responses,
 * error handling, validation, security, and monitoring in the web application.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import rateLimit from 'axios-rate-limit'; // ^1.3.0
import { ApiResponse, ApiError, API_ERROR_CODES } from '../types/api.types';
import { apiConfig } from '../config/api.config';

// Constants for API request configuration
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUEST_SIZE = 5242880; // 5MB

/**
 * Creates a configured axios instance with enhanced security, monitoring, and retry capabilities
 * @returns Configured axios instance
 */
export const createApiRequest = (): AxiosInstance => {
  // Create base axios instance
  const instance = axios.create({
    baseURL: apiConfig.baseUrl,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      ...apiConfig.headers,
      'Content-Type': 'application/json'
    }
  });

  // Configure retry mechanism
  axiosRetry(instance, {
    retries: MAX_RETRIES,
    retryDelay: (retryCount) => {
      return retryCount * RETRY_DELAY * apiConfig.retryPolicy.backoffFactor;
    },
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        apiConfig.retryPolicy.retryableStatuses.includes(error.response?.status || 0);
    }
  });

  // Apply rate limiting
  const rateLimitedInstance = rateLimit(instance, {
    maxRequests: RATE_LIMIT_MAX,
    perMilliseconds: RATE_LIMIT_WINDOW
  });

  // Request interceptor
  rateLimitedInstance.interceptors.request.use(
    (config) => {
      if (!validateRequestConfig(config)) {
        throw new Error('Invalid request configuration');
      }
      
      // Add security headers
      config.headers = {
        ...config.headers,
        'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0'
      };

      return config;
    },
    (error) => Promise.reject(handleApiError(error))
  );

  // Response interceptor
  rateLimitedInstance.interceptors.response.use(
    (response) => {
      trackApiMetrics(response.config, response);
      return response;
    },
    (error) => Promise.reject(handleApiError(error))
  );

  return rateLimitedInstance;
};

/**
 * Enhanced error handler with detailed context and monitoring
 * @param error - Axios error object
 * @returns Standardized API error
 */
export const handleApiError = (error: AxiosError): ApiError => {
  const timestamp = new Date().toISOString();
  const requestId = error.config?.headers?.['X-Request-ID'] || 'unknown';

  // Log error for monitoring
  console.error('[API Error]', {
    timestamp,
    requestId,
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    error: error.message
  });

  // Map to standard error format
  const apiError: ApiError = {
    code: mapErrorCodeToApiErrorCode(error.response?.status),
    message: error.response?.data?.message || error.message,
    details: {
      timestamp,
      path: error.config?.url,
      method: error.config?.method,
      status: error.response?.status
    },
    requestId
  };

  // Track error metrics
  trackErrorMetrics(apiError);

  return apiError;
};

/**
 * Validates request configuration for security compliance
 * @param config - Axios request configuration
 * @returns boolean indicating if config is valid
 */
export const validateRequestConfig = (config: AxiosRequestConfig): boolean => {
  try {
    // Validate required headers
    if (!config.headers?.['Content-Type']) {
      return false;
    }

    // Validate URL structure
    const url = new URL(config.url || '', apiConfig.baseUrl);
    if (!url.protocol.startsWith('https') && process.env.NODE_ENV === 'production') {
      return false;
    }

    // Validate content size
    const contentLength = parseInt(config.headers['Content-Length'] || '0');
    if (contentLength > MAX_REQUEST_SIZE) {
      return false;
    }

    // Validate content type
    const contentType = config.headers['Content-Type'];
    if (!apiConfig.validation.allowedContentTypes.includes(contentType)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Request Validation Error]', error);
    return false;
  }
};

/**
 * Collects and reports API metrics
 * @param requestConfig - Request configuration
 * @param response - API response
 */
export const trackApiMetrics = (
  requestConfig: AxiosRequestConfig,
  response: AxiosResponse
): void => {
  const timestamp = new Date().toISOString();
  const duration = Date.now() - (requestConfig.timestamp || Date.now());

  // Metric data structure
  const metrics = {
    timestamp,
    requestId: requestConfig.headers?.['X-Request-ID'],
    method: requestConfig.method,
    path: requestConfig.url,
    status: response.status,
    duration,
    payloadSize: JSON.stringify(response.data).length,
    success: response.status >= 200 && response.status < 300
  };

  // Log metrics for monitoring
  if (apiConfig.monitoring.enableMetrics) {
    console.info('[API Metrics]', metrics);
  }

  // Could be extended to send metrics to monitoring service
  // e.g., Prometheus, DataDog, etc.
};

/**
 * Maps HTTP status codes to API error codes
 * @param status - HTTP status code
 * @returns API error code
 */
const mapErrorCodeToApiErrorCode = (status?: number): keyof typeof API_ERROR_CODES => {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 404:
      return 'NOT_FOUND';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 400:
      return 'INVALID_REQUEST';
    default:
      return 'SERVER_ERROR';
  }
};

/**
 * Tracks error metrics for monitoring
 * @param error - API error object
 */
const trackErrorMetrics = (error: ApiError): void => {
  if (apiConfig.monitoring.enableMetrics) {
    console.error('[Error Metrics]', {
      timestamp: new Date().toISOString(),
      errorCode: error.code,
      requestId: error.requestId,
      details: error.details
    });
  }
};