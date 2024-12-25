/**
 * @fileoverview Secure storage service providing encrypted browser storage operations
 * with comprehensive error handling, type safety, and data integrity verification.
 * @version 1.0.0
 */

import * as CryptoJS from 'crypto-js'; // v4.1.1
import { z } from 'zod'; // v3.22.0
import {
  setLocalStorageItem,
  getLocalStorageItem,
  removeLocalStorageItem,
  setSessionStorageItem,
  getSessionStorageItem,
  removeSessionStorageItem,
  isStorageAvailable,
  StorageError
} from '../utils/storage.utils';

/**
 * Configuration options for storage operations
 */
export interface StorageOptions {
  persistent?: boolean;
  expiresIn?: number;
  integrity?: boolean;
}

/**
 * Configuration for key rotation operations
 */
export interface RotationOptions {
  deleteOld?: boolean;
  backupFirst?: boolean;
}

/**
 * Service configuration schema
 */
const StorageConfigSchema = z.object({
  maxRetries: z.number().min(1).max(5).default(3),
  cacheTimeout: z.number().min(0).max(3600000).default(300000),
  integrityCheck: z.boolean().default(true)
});

type StorageConfig = z.infer<typeof StorageConfigSchema>;

/**
 * Encryption key validation schema
 */
const EncryptionKeySchema = z.string().min(32).max(64);

/**
 * Storage prefix validation schema
 */
const PrefixSchema = z.string().min(2).max(10).regex(/^[a-zA-Z0-9_-]+$/);

/**
 * Service class providing encrypted storage operations with comprehensive error handling
 */
export class StorageService {
  private readonly encryptionKey: string;
  private readonly prefix: string;
  private readonly maxRetries: number;
  private readonly decryptionCache: Map<string, { value: any; timestamp: number }>;
  private readonly cacheTimeout: number;
  private readonly integrityCheck: boolean;

  /**
   * Creates a new instance of StorageService
   * @param encryptionKey - Key used for encrypting/decrypting data
   * @param prefix - Prefix for storage keys
   * @param config - Service configuration options
   * @throws {Error} If storage is unavailable or configuration is invalid
   */
  constructor(
    encryptionKey: string,
    prefix: string,
    config: Partial<StorageConfig> = {}
  ) {
    // Validate inputs
    this.encryptionKey = EncryptionKeySchema.parse(encryptionKey);
    this.prefix = PrefixSchema.parse(prefix);

    // Parse and validate configuration
    const validatedConfig = StorageConfigSchema.parse(config);
    this.maxRetries = validatedConfig.maxRetries;
    this.cacheTimeout = validatedConfig.cacheTimeout;
    this.integrityCheck = validatedConfig.integrityCheck;

    // Initialize cache
    this.decryptionCache = new Map();

    // Verify storage availability
    if (!isStorageAvailable('localStorage') || !isStorageAvailable('sessionStorage')) {
      throw new Error('Browser storage is not available');
    }
  }

  /**
   * Generates a prefixed storage key
   * @param key - Original key
   * @returns Prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}_${key}`;
  }

  /**
   * Encrypts data with integrity check
   * @param value - Value to encrypt
   * @returns Encrypted data with integrity hash
   */
  private encrypt(value: any): string {
    const serializedValue = JSON.stringify(value);
    const integrityHash = this.integrityCheck
      ? CryptoJS.SHA256(serializedValue + this.encryptionKey).toString()
      : '';
    
    const dataToEncrypt = this.integrityCheck
      ? JSON.stringify({ value: serializedValue, hash: integrityHash })
      : serializedValue;

    return CryptoJS.AES.encrypt(dataToEncrypt, this.encryptionKey).toString();
  }

  /**
   * Decrypts data and verifies integrity
   * @param encrypted - Encrypted data
   * @returns Decrypted value
   * @throws {Error} If integrity check fails or decryption fails
   */
  private decrypt(encrypted: string): any {
    const decrypted = CryptoJS.AES.decrypt(encrypted, this.encryptionKey).toString(CryptoJS.enc.Utf8);

    if (this.integrityCheck) {
      const { value, hash } = JSON.parse(decrypted);
      const calculatedHash = CryptoJS.SHA256(value + this.encryptionKey).toString();
      
      if (hash !== calculatedHash) {
        throw new Error('Data integrity check failed');
      }
      
      return JSON.parse(value);
    }

    return JSON.parse(decrypted);
  }

  /**
   * Stores an encrypted item with retry mechanism
   * @param key - Storage key
   * @param value - Value to store
   * @param options - Storage options
   * @returns Promise resolving when storage is successful
   * @throws {Error} If storage fails after retries
   */
  async setItem<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    const encrypted = this.encrypt(value);

    const storageOperation = options.persistent
      ? () => setLocalStorageItem(prefixedKey, encrypted)
      : () => setSessionStorageItem(prefixedKey, encrypted);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await storageOperation();
        
        // Update cache
        this.decryptionCache.set(prefixedKey, {
          value,
          timestamp: Date.now()
        });
        
        return;
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw lastError || new Error('Failed to store item after retries');
  }

  /**
   * Retrieves and decrypts an item
   * @param key - Storage key
   * @param options - Storage options
   * @returns Promise resolving to decrypted value or null
   * @throws {Error} If retrieval or decryption fails
   */
  async getItem<T>(key: string, options: StorageOptions = {}): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    
    // Check cache first
    const cached = this.decryptionCache.get(prefixedKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value as T;
    }

    const getOperation = options.persistent
      ? () => getLocalStorageItem<string>(prefixedKey)
      : () => getSessionStorageItem<string>(prefixedKey);

    const encrypted = await getOperation();
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted) as T;
      
      // Update cache
      this.decryptionCache.set(prefixedKey, {
        value: decrypted,
        timestamp: Date.now()
      });

      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt item');
    }
  }

  /**
   * Removes an item from storage
   * @param key - Storage key
   * @param options - Storage options
   */
  async removeItem(key: string, options: StorageOptions = {}): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    
    const removeOperation = options.persistent
      ? () => removeLocalStorageItem(prefixedKey)
      : () => removeSessionStorageItem(prefixedKey);

    await removeOperation();
    this.decryptionCache.delete(prefixedKey);
  }

  /**
   * Rotates encryption key for all stored values
   * @param newKey - New encryption key
   * @param options - Rotation options
   * @returns Promise resolving when rotation is complete
   * @throws {Error} If rotation fails
   */
  async rotateEncryptionKey(newKey: string, options: RotationOptions = {}): Promise<void> {
    const validatedNewKey = EncryptionKeySchema.parse(newKey);
    
    // Get all keys with our prefix
    const keys = Object.keys(localStorage).concat(Object.keys(sessionStorage))
      .filter(key => key.startsWith(this.prefix));

    for (const key of keys) {
      try {
        // Get current value
        const value = await this.getItem(key.substring(this.prefix.length + 1));
        if (value === null) continue;

        // Store with new key
        const oldKey = this.encryptionKey;
        this.encryptionKey = validatedNewKey;
        await this.setItem(key.substring(this.prefix.length + 1), value);
        
        // Cleanup if requested
        if (options.deleteOld) {
          this.encryptionKey = oldKey;
          await this.removeItem(key.substring(this.prefix.length + 1));
        }
      } catch (error) {
        throw new Error(`Failed to rotate key for ${key}`);
      }
    }

    // Update encryption key reference
    this.encryptionKey = validatedNewKey;
    this.decryptionCache.clear();
  }
}