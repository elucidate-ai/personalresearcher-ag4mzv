/**
 * @fileoverview Type-safe utility functions for browser storage operations with comprehensive error handling,
 * security features, and storage availability checking. Provides wrappers around localStorage and sessionStorage
 * with enhanced security measures and data validation.
 * @version 1.0.0
 */

/**
 * Defines the supported storage types for browser storage operations
 */
export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Custom error class for storage-related errors with error codes
 */
export class StorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Error codes for storage operations
 */
const ERROR_CODES = {
  INVALID_KEY: 'STORAGE_INVALID_KEY',
  QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  SECURITY_ERROR: 'STORAGE_SECURITY_ERROR',
  PARSE_ERROR: 'STORAGE_PARSE_ERROR',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  UNKNOWN_ERROR: 'STORAGE_UNKNOWN_ERROR'
} as const;

/**
 * Checks if browser storage (localStorage or sessionStorage) is available and functioning
 * @param type - The type of storage to check
 * @returns boolean indicating if storage is available
 */
export const isStorageAvailable = (type: StorageType): boolean => {
  try {
    const storage = window[type];
    const testKey = `__storage_test_${Date.now()}__`;
    storage.setItem(testKey, testKey);
    const result = storage.getItem(testKey) === testKey;
    storage.removeItem(testKey);
    return result;
  } catch (e) {
    return false;
  }
};

/**
 * Sets an item in localStorage with enhanced error handling and type safety
 * @param key - The key to store the value under
 * @param value - The value to store
 * @throws {StorageError} If storage operation fails
 */
export const setLocalStorageItem = (key: string, value: unknown): void => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('localStorage')) {
    throw new StorageError('localStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        throw new StorageError('Storage quota exceeded', ERROR_CODES.QUOTA_EXCEEDED);
      } else if (error.name === 'SecurityError') {
        throw new StorageError('Security error: Private browsing mode may be enabled', ERROR_CODES.SECURITY_ERROR);
      }
    }
    throw new StorageError('Failed to set item in localStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Retrieves and type-safely parses an item from localStorage
 * @param key - The key of the item to retrieve
 * @returns The parsed value or null if not found
 * @throws {StorageError} If retrieval or parsing fails
 */
export const getLocalStorageItem = <T>(key: string): T | null => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('localStorage')) {
    throw new StorageError('localStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) return null;
    
    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  } catch (error) {
    throw new StorageError('Failed to get item from localStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Removes an item from localStorage
 * @param key - The key of the item to remove
 * @throws {StorageError} If removal fails
 */
export const removeLocalStorageItem = (key: string): void => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('localStorage')) {
    throw new StorageError('localStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    localStorage.removeItem(key);
  } catch (error) {
    throw new StorageError('Failed to remove item from localStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Safely clears all items from localStorage
 * @throws {StorageError} If clearing fails
 */
export const clearLocalStorage = (): void => {
  if (!isStorageAvailable('localStorage')) {
    throw new StorageError('localStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    localStorage.clear();
  } catch (error) {
    throw new StorageError('Failed to clear localStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Sets an item in sessionStorage with enhanced error handling and type safety
 * @param key - The key to store the value under
 * @param value - The value to store
 * @throws {StorageError} If storage operation fails
 */
export const setSessionStorageItem = (key: string, value: unknown): void => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('sessionStorage')) {
    throw new StorageError('sessionStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    sessionStorage.setItem(key, serializedValue);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        throw new StorageError('Storage quota exceeded', ERROR_CODES.QUOTA_EXCEEDED);
      } else if (error.name === 'SecurityError') {
        throw new StorageError('Security error: Private browsing mode may be enabled', ERROR_CODES.SECURITY_ERROR);
      }
    }
    throw new StorageError('Failed to set item in sessionStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Retrieves and type-safely parses an item from sessionStorage
 * @param key - The key of the item to retrieve
 * @returns The parsed value or null if not found
 * @throws {StorageError} If retrieval or parsing fails
 */
export const getSessionStorageItem = <T>(key: string): T | null => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('sessionStorage')) {
    throw new StorageError('sessionStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    const item = sessionStorage.getItem(key);
    if (item === null) return null;
    
    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  } catch (error) {
    throw new StorageError('Failed to get item from sessionStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Removes an item from sessionStorage
 * @param key - The key of the item to remove
 * @throws {StorageError} If removal fails
 */
export const removeSessionStorageItem = (key: string): void => {
  if (!key) {
    throw new StorageError('Invalid storage key provided', ERROR_CODES.INVALID_KEY);
  }

  if (!isStorageAvailable('sessionStorage')) {
    throw new StorageError('sessionStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    throw new StorageError('Failed to remove item from sessionStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};

/**
 * Safely clears all items from sessionStorage
 * @throws {StorageError} If clearing fails
 */
export const clearSessionStorage = (): void => {
  if (!isStorageAvailable('sessionStorage')) {
    throw new StorageError('sessionStorage is not available', ERROR_CODES.STORAGE_UNAVAILABLE);
  }

  try {
    sessionStorage.clear();
  } catch (error) {
    throw new StorageError('Failed to clear sessionStorage', ERROR_CODES.UNKNOWN_ERROR);
  }
};