/**
 * Authentication Configuration
 * Provides secure Auth0 configuration and token management settings with OWASP compliance
 * @version 1.0.0
 */

import { AUTH_ROLES } from '../constants/auth.constants';

/**
 * Interface defining authentication configuration structure
 */
interface AuthConfig {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  defaultRole: AUTH_ROLES;
  securitySettings: SecuritySettings;
}

/**
 * Interface defining token lifecycle configuration
 */
interface TokenConfig {
  accessTokenExpiryMinutes: number;
  refreshTokenExpiryDays: number;
  tokenRefreshThresholdMinutes: number;
  secureStorage: StorageConfig;
  cookieSettings: CookieConfig;
}

/**
 * Interface for OWASP-compliant security settings
 */
interface SecuritySettings {
  requireHttps: boolean;
  sameSitePolicy: 'strict' | 'lax' | 'none';
  enableCSRF: boolean;
  allowedOrigins: string[];
  rateLimit: RateLimitConfig;
}

/**
 * Interface for secure token storage configuration
 */
interface StorageConfig {
  storageType: 'localStorage' | 'sessionStorage' | 'memory';
  tokenPrefix: string;
  useEncryption: boolean;
  encryptionKey: string;
}

/**
 * Interface for secure cookie configuration
 */
interface CookieConfig {
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  domain: string;
}

/**
 * Interface for rate limiting configuration
 */
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

/**
 * Validates security settings against OWASP requirements
 * @param settings Security settings to validate
 * @returns boolean indicating if settings meet security requirements
 */
const validateSecuritySettings = (settings: SecuritySettings): boolean => {
  if (!settings.requireHttps) {
    console.error('SECURITY WARNING: HTTPS is required for production environments');
    return false;
  }

  if (settings.sameSitePolicy !== 'strict' && process.env.NODE_ENV === 'production') {
    console.error('SECURITY WARNING: SameSite policy should be strict in production');
    return false;
  }

  if (!settings.enableCSRF) {
    console.error('SECURITY WARNING: CSRF protection should be enabled');
    return false;
  }

  return true;
};

/**
 * Auth0 configuration with enhanced security settings
 * Implements OWASP security recommendations
 */
export const authConfig: AuthConfig = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  audience: process.env.AUTH0_AUDIENCE || '',
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  responseType: 'code',
  scope: 'openid profile email offline_access',
  defaultRole: AUTH_ROLES.BASIC_USER,
  securitySettings: {
    requireHttps: true,
    sameSitePolicy: 'strict',
    enableCSRF: true,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
    rateLimit: {
      maxAttempts: 5,
      windowMs: 5 * 60 * 1000 // 5 minutes
    }
  }
};

/**
 * Token management configuration with secure defaults
 * Implements security best practices for token lifecycle
 */
export const tokenConfig: TokenConfig = {
  accessTokenExpiryMinutes: 30,
  refreshTokenExpiryDays: 7,
  tokenRefreshThresholdMinutes: 5,
  secureStorage: {
    storageType: 'localStorage',
    tokenPrefix: 'auth_',
    useEncryption: true,
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || ''
  },
  cookieSettings: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    domain: process.env.COOKIE_DOMAIN || ''
  }
};

/**
 * Retrieves environment-specific authentication configuration
 * Validates security settings before returning configuration
 */
export const getAuthConfig = (): AuthConfig => {
  // Validate required environment variables
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID) {
    throw new Error('Required authentication configuration is missing');
  }

  // Validate security settings
  if (!validateSecuritySettings(authConfig.securitySettings)) {
    throw new Error('Security settings do not meet OWASP requirements');
  }

  // Return immutable configuration object
  return Object.freeze({ ...authConfig });
};

/**
 * Retrieves token configuration with environment-specific overrides
 * Ensures secure token management settings
 */
export const getTokenConfig = (): TokenConfig => {
  // Validate encryption key for secure storage
  if (tokenConfig.secureStorage.useEncryption && !process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('Token encryption key is required when encryption is enabled');
  }

  // Return immutable configuration object
  return Object.freeze({ ...tokenConfig });
};