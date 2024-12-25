import { format, formatDistance, parseISO } from 'date-fns'; // v2.30.0

/**
 * Cache for relative time calculations to improve performance
 * Key: ISO date string, Value: { timestamp: number, formatted: string }
 */
const relativeTimeCache = new Map<string, { timestamp: number; formatted: string }>();

/**
 * Cache expiration time in milliseconds (5 minutes)
 */
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Default date format string used when none is provided
 */
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Error messages for date utility functions
 */
const ERROR_MESSAGES = {
  INVALID_DATE: 'Invalid date provided',
  INVALID_FORMAT: 'Invalid format string',
  INVALID_RANGE: 'Invalid date range',
  INVALID_ARRAY: 'Invalid array input',
  INVALID_FIELD: 'Invalid date field specified',
} as const;

/**
 * Type guard to check if a value is a valid Date object
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid Date
 */
const isValidDate = (value: any): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};

/**
 * Formats a date string or Date object into a standardized display format
 * @param date - Date to format (Date object or ISO string)
 * @param formatString - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string or error message
 */
export const formatDate = (date: Date | string, formatString: string = DEFAULT_DATE_FORMAT): string => {
  try {
    if (!date) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValidDate(dateObj)) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    if (typeof formatString !== 'string') {
      formatString = DEFAULT_DATE_FORMAT;
    }

    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return ERROR_MESSAGES.INVALID_DATE;
  }
};

/**
 * Calculates and formats the relative time between a date and now
 * Implements caching for performance optimization
 * @param date - Date to calculate relative time from (Date object or ISO string)
 * @returns Relative time string with localization support
 */
export const getRelativeTime = (date: Date | string): string => {
  try {
    if (!date) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValidDate(dateObj)) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    const dateString = dateObj.toISOString();
    const now = Date.now();

    // Check cache for valid entry
    const cached = relativeTimeCache.get(dateString);
    if (cached && (now - cached.timestamp) < CACHE_EXPIRATION) {
      return cached.formatted;
    }

    // Calculate new relative time
    const formatted = formatDistance(dateObj, new Date(), { addSuffix: true });
    
    // Update cache
    relativeTimeCache.set(dateString, {
      timestamp: now,
      formatted,
    });

    return formatted;
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return ERROR_MESSAGES.INVALID_DATE;
  }
};

/**
 * Checks if a date falls within a specified range
 * @param date - Date to check (Date object or ISO string)
 * @param startDate - Start of range (Date object or ISO string)
 * @param endDate - End of range (Date object or ISO string)
 * @returns Boolean indicating if date is within range
 */
export const isDateInRange = (
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean => {
  try {
    if (!date || !startDate || !endDate) {
      throw new Error(ERROR_MESSAGES.INVALID_RANGE);
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const startObj = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const endObj = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValidDate(dateObj) || !isValidDate(startObj) || !isValidDate(endObj)) {
      throw new Error(ERROR_MESSAGES.INVALID_RANGE);
    }

    if (startObj > endObj) {
      throw new Error(ERROR_MESSAGES.INVALID_RANGE);
    }

    return dateObj >= startObj && dateObj <= endObj;
  } catch (error) {
    console.error('Error checking date range:', error);
    return false;
  }
};

/**
 * Sorts an array of objects by their date property
 * Optimized for performance with large datasets
 * @param items - Array of objects containing date fields
 * @param dateField - Name of the date field to sort by
 * @param ascending - Sort direction (default: true for ascending)
 * @returns Sorted array of items
 */
export const sortByDate = <T extends { [key: string]: any }>(
  items: T[],
  dateField: string,
  ascending: boolean = true
): T[] => {
  try {
    if (!Array.isArray(items)) {
      throw new Error(ERROR_MESSAGES.INVALID_ARRAY);
    }

    if (typeof dateField !== 'string' || !dateField) {
      throw new Error(ERROR_MESSAGES.INVALID_FIELD);
    }

    // Create shallow copy for immutability
    const sortedItems = [...items];

    // Optimized stable sort implementation
    return sortedItems.sort((a, b) => {
      try {
        const dateA = typeof a[dateField] === 'string' ? parseISO(a[dateField]) : a[dateField];
        const dateB = typeof b[dateField] === 'string' ? parseISO(b[dateField]) : b[dateField];

        if (!isValidDate(dateA) || !isValidDate(dateB)) {
          return 0;
        }

        const comparison = dateA.getTime() - dateB.getTime();
        return ascending ? comparison : -comparison;
      } catch (error) {
        console.error('Error comparing dates:', error);
        return 0;
      }
    });
  } catch (error) {
    console.error('Error sorting by date:', error);
    return [...items]; // Return unsorted copy on error
  }
};

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of relativeTimeCache.entries()) {
    if (now - value.timestamp > CACHE_EXPIRATION) {
      relativeTimeCache.delete(key);
    }
  }
}, CACHE_EXPIRATION);