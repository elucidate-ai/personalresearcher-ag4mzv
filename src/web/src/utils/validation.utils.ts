/**
 * Validation Utilities
 * Version: 1.0.0
 * 
 * Comprehensive utility functions for secure input validation, data sanitization,
 * and type checking with enhanced security controls.
 */

import { isEmail, isURL, escape } from 'validator'; // v13.11.0
import { AuthUser } from '../types/auth.types';
import { ApiError } from '../types/api.types';

// Constants for validation rules
const PASSWORD_MIN_LENGTH = 8;
const ALLOWED_PROTOCOLS = ['http', 'https'] as const;
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const ALLOWED_CONTENT_TYPES = ['VIDEO', 'ARTICLE', 'PODCAST', 'BOOK'] as const;
const PASSWORD_SPECIAL_CHARS = ['@', '$', '!', '%', '*', '?', '&'] as const;
const MAX_URL_LENGTH = 2083;

// Blacklisted domains for security
const BLACKLISTED_DOMAINS = new Set([
  'tempmail.com',
  'disposable.com',
  'throwaway.com'
]);

/**
 * Comprehensive email validation with enhanced security checks
 * @param email - Email address to validate
 * @returns Validation result with sanitized email
 */
export function validateEmail(email: string): {
  isValid: boolean;
  errors: string[];
  sanitizedEmail: string;
} {
  const errors: string[] = [];
  const sanitizedEmail = escape(email.trim().toLowerCase());

  // Basic format validation
  if (!isEmail(sanitizedEmail)) {
    errors.push('Invalid email format');
  }

  // Regex pattern validation
  if (!EMAIL_REGEX.test(sanitizedEmail)) {
    errors.push('Email does not match required pattern');
  }

  // Domain validation
  const [, domain] = sanitizedEmail.split('@');
  if (domain && BLACKLISTED_DOMAINS.has(domain)) {
    errors.push('Email domain not allowed');
  }

  // Length validation
  if (sanitizedEmail.length > 254) { // RFC 5321
    errors.push('Email exceeds maximum length');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedEmail
  };
}

/**
 * Enhanced password validation with comprehensive security requirements
 * @param password - Password to validate
 * @returns Validation result with strength score
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  } else {
    score += 1;
  }

  // Character type checks
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!PASSWORD_SPECIAL_CHARS.some(char => password.includes(char))) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Common pattern checks
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains repeated characters');
    score -= 1;
  }

  if (/^(123|abc|qwerty)/i.test(password)) {
    errors.push('Password contains common patterns');
    score -= 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.max(0, score)
  };
}

/**
 * Secure URL validation with comprehensive checks
 * @param url - URL to validate
 * @returns Validation result with sanitized URL
 */
export function validateUrl(url: string): {
  isValid: boolean;
  errors: string[];
  sanitizedUrl: string;
} {
  const errors: string[] = [];
  const sanitizedUrl = escape(url.trim());

  // Basic URL validation
  if (!isURL(sanitizedUrl, {
    protocols: ALLOWED_PROTOCOLS,
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: true,
    validate_length: true
  })) {
    errors.push('Invalid URL format');
  }

  // Length validation
  if (sanitizedUrl.length > MAX_URL_LENGTH) {
    errors.push(`URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
  }

  // Protocol validation
  const protocol = sanitizedUrl.split('://')[0];
  if (!ALLOWED_PROTOCOLS.includes(protocol as typeof ALLOWED_PROTOCOLS[number])) {
    errors.push('URL protocol not allowed');
  }

  // Query parameter validation
  const hasQueryParams = sanitizedUrl.includes('?');
  if (hasQueryParams) {
    const queryString = sanitizedUrl.split('?')[1];
    if (queryString.includes('<') || queryString.includes('>')) {
      errors.push('URL contains invalid characters in query parameters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedUrl
  };
}

/**
 * Strict content type validation with security checks
 * @param contentType - Content type to validate
 * @returns Validation result with normalized content type
 */
export function validateContentType(contentType: string): {
  isValid: boolean;
  errors: string[];
  normalizedType: string;
} {
  const errors: string[] = [];
  const normalizedType = escape(contentType.trim().toUpperCase());

  // Check against allowed content types
  if (!ALLOWED_CONTENT_TYPES.includes(normalizedType as typeof ALLOWED_CONTENT_TYPES[number])) {
    errors.push('Invalid content type');
  }

  // Additional MIME type validation if provided
  if (normalizedType.includes('/')) {
    const [type, subtype] = normalizedType.split('/');
    if (!type || !subtype) {
      errors.push('Invalid MIME type format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedType
  };
}

/**
 * Type guard for checking if an error is a validation error
 * @param error - Error to check
 * @returns Boolean indicating if error is a validation error
 */
export function isValidationError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    (error as ApiError).code === 'VALIDATION_ERROR'
  );
}

/**
 * Validates user input against potential security threats
 * @param input - String input to validate
 * @returns Sanitized input string
 */
export function sanitizeInput(input: string): string {
  // Remove potential script tags and HTML entities
  let sanitized = escape(input.trim());
  
  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)/gi, '');
  
  // Remove potential script injection patterns
  sanitized = sanitized.replace(/<(script|iframe|object|embed|applet)/gi, '');
  
  return sanitized;
}