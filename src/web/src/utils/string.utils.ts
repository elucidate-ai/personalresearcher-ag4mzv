/**
 * @fileoverview String manipulation utilities with enhanced security, validation, and i18n support
 * @version 1.0.0
 * @license MIT
 */

// Constants for configuration
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] as const;
const MAX_STRING_LENGTH = 10000;
const SECURITY_OPTIONS = {
  xssFilter: true,
  maxLength: MAX_STRING_LENGTH,
  allowedTags: [],
  sanitize: true
} as const;

// Types
interface TruncateOptions {
  ellipsis?: string;
  wordBoundary?: boolean;
  preserveWords?: boolean;
}

interface SlugifyOptions {
  lowercase?: boolean;
  separator?: string;
  preserveLeadingUnderscore?: boolean;
  preserveTrailingDash?: boolean;
}

interface StripHtmlOptions {
  preserveNewlines?: boolean;
  preserveEntities?: boolean;
}

interface ByteFormatOptions {
  locale?: string;
  binary?: boolean;
}

/**
 * Decorator for input validation
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    if (args.some(arg => arg === null || arg === undefined)) {
      throw new Error('Invalid input: null or undefined values not allowed');
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Memoization decorator for performance optimization
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();
  
  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}

/**
 * Safely truncates a string to a specified length with Unicode support
 * @param text - The input string to truncate
 * @param maxLength - Maximum length of the output string
 * @param options - Configuration options for truncation
 * @returns Truncated string with ellipsis if needed
 * @throws Error if input validation fails
 */
@validateInput
@memoize
export function truncateString(
  text: string,
  maxLength: number,
  options: TruncateOptions = {}
): string {
  if (maxLength <= 0) {
    throw new Error('maxLength must be greater than 0');
  }
  
  if (maxLength > MAX_STRING_LENGTH) {
    throw new Error(`maxLength cannot exceed ${MAX_STRING_LENGTH}`);
  }

  const {
    ellipsis = '...',
    wordBoundary = true,
    preserveWords = true
  } = options;

  // Normalize string for consistent Unicode handling
  const normalizedText = text.normalize('NFC');
  
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  let truncated = normalizedText.slice(0, maxLength - ellipsis.length);

  if (preserveWords && wordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return `${truncated}${ellipsis}`;
}

/**
 * Capitalizes the first letter of a string with Unicode support
 * @param text - The input string to capitalize
 * @returns String with first letter capitalized
 * @throws Error if input validation fails
 */
@validateInput
export function capitalizeFirstLetter(text: string): string {
  if (text.length === 0) {
    return text;
  }

  const normalized = text.normalize('NFC');
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

/**
 * Converts a string to a secure URL-friendly slug
 * @param text - The input string to convert to a slug
 * @param options - Configuration options for slug generation
 * @returns Secure URL-friendly slug string
 * @throws Error if input validation fails
 */
@validateInput
export function slugify(text: string, options: SlugifyOptions = {}): string {
  const {
    lowercase = true,
    separator = '-',
    preserveLeadingUnderscore = false,
    preserveTrailingDash = false
  } = options;

  // Normalize and convert to lowercase if specified
  let slug = text.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/\s+/g, separator) // Replace spaces with separator
    .replace(/-+/g, separator); // Replace multiple separators

  if (lowercase) {
    slug = slug.toLowerCase();
  }

  // Handle special cases for leading/trailing characters
  if (!preserveLeadingUnderscore) {
    slug = slug.replace(/^[_-]+/, '');
  }
  
  if (!preserveTrailingDash) {
    slug = slug.replace(/[-_]+$/, '');
  }

  return slug;
}

/**
 * Securely removes HTML tags with XSS protection
 * @param html - The input HTML string to strip
 * @param options - Configuration options for HTML stripping
 * @returns Sanitized plain text without HTML tags
 * @throws Error if input validation fails
 */
@validateInput
export function stripHtml(html: string, options: StripHtmlOptions = {}): string {
  const {
    preserveNewlines = false,
    preserveEntities = false
  } = options;

  // Create a secure DOM parser in a sandbox
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let text = doc.body.textContent || '';

  // Handle newlines
  if (preserveNewlines) {
    text = text.replace(/\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    text = text.replace(/\s+/g, ' ').trim();
  }

  // Handle HTML entities
  if (!preserveEntities) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
  }

  return text;
}

/**
 * Formats byte values into localized human-readable strings
 * @param bytes - The number of bytes to format
 * @param decimals - Number of decimal places in output
 * @param options - Configuration options for byte formatting
 * @returns Localized formatted string with appropriate unit
 * @throws Error if input validation fails
 */
@validateInput
export function formatBytes(
  bytes: number,
  decimals: number = 2,
  options: ByteFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    binary = false
  } = options;

  if (bytes === 0) {
    return `0 ${BYTE_UNITS[0]}`;
  }

  if (decimals < 0) {
    throw new Error('Decimals must be non-negative');
  }

  const base = binary ? 1024 : 1000;
  const exponent = Math.floor(Math.log(bytes) / Math.log(base));
  const unit = BYTE_UNITS[exponent];

  if (!unit) {
    throw new Error('Byte value out of range');
  }

  const value = bytes / Math.pow(base, exponent);
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value) + ` ${unit}`;
}