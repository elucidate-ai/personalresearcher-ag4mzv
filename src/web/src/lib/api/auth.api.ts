/**
 * Enhanced Authentication API Client
 * Implements secure Auth0 integration with OWASP-compliant token management
 * @version 1.0.0
 */

import { Auth0Client } from '@auth0/auth0-spa-js'; // ^2.1.0
import axios, { AxiosInstance } from 'axios'; // ^1.6.0
import CryptoJS from 'crypto-js'; // ^4.2.0

import { AuthUser, LoginCredentials, AuthError, AuthResponse } from '../../types/auth.types';
import { authConfig } from '../../config/auth.config';
import { AUTH_ERRORS, TOKEN_STORAGE_KEYS } from '../../constants/auth.constants';

/**
 * Token encryption handler for secure token storage
 */
class TokenEncryptor {
  constructor(private encryptionKey: string) {}

  encrypt(token: string): string {
    return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
  }

  decrypt(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

/**
 * Rate limiter implementation for request throttling
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(private maxAttempts: number, private windowMs: number) {}

  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    this.attempts.set(key, recentAttempts);
    return recentAttempts.length < this.maxAttempts;
  }

  addAttempt(key: string): void {
    const attempts = this.attempts.get(key) || [];
    attempts.push(Date.now());
    this.attempts.set(key, attempts);
  }
}

/**
 * Retry handler for failed requests
 */
class RetryHandler {
  constructor(private maxRetries: number, private backoffFactor: number) {}

  async retry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        await this.delay(attempt);
      }
    }
    throw lastError!;
  }

  private delay(attempt: number): Promise<void> {
    const ms = Math.min(1000 * Math.pow(this.backoffFactor, attempt), 5000);
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Enhanced Authentication API Client
 * Implements secure authentication with advanced security features
 */
export class AuthApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly tokenEncryptor: TokenEncryptor;
  private readonly rateLimiter: RateLimiter;
  private readonly retryHandler: RetryHandler;

  constructor(
    private readonly auth0Client: Auth0Client,
    private readonly baseUrl: string = '/api/auth'
  ) {
    // Initialize security components
    this.tokenEncryptor = new TokenEncryptor(authConfig.securitySettings.encryptionKey);
    this.rateLimiter = new RateLimiter(
      authConfig.securitySettings.rateLimit.maxAttempts,
      authConfig.securitySettings.rateLimit.windowMs
    );
    this.retryHandler = new RetryHandler(3, 1.5);

    // Configure secure axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.generateCSRFToken()
      }
    });

    // Add security interceptors
    this.setupInterceptors();
  }

  /**
   * Authenticates user with enhanced security validation
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Check rate limiting
      if (!this.rateLimiter.checkRateLimit(credentials.email)) {
        throw this.createAuthError(AUTH_ERRORS.UNAUTHORIZED, 'Rate limit exceeded');
      }

      // Validate credentials
      this.validateCredentials(credentials);

      // Attempt authentication with retry mechanism
      const authResult = await this.retryHandler.retry(async () => {
        const response = await this.auth0Client.loginWithCredentials({
          username: credentials.email,
          password: credentials.password,
          realm: 'Username-Password-Authentication'
        });

        // Validate MFA if enabled
        if (response.mfaRequired && !credentials.mfaCode) {
          throw this.createAuthError(AUTH_ERRORS.UNAUTHORIZED, 'MFA code required');
        }

        return response;
      });

      // Process and secure tokens
      const tokens = this.processAuthTokens(authResult);

      // Initialize session tracking
      this.initializeSession(tokens);

      return tokens;

    } catch (error) {
      this.rateLimiter.addAttempt(credentials.email);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Securely terminates user session
   */
  async logout(): Promise<void> {
    try {
      // Revoke tokens
      await this.revokeTokens();

      // Clear secure storage
      this.clearSecureStorage();

      // End Auth0 session
      await this.auth0Client.logout({
        returnTo: window.location.origin
      });

    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Securely refreshes authentication tokens
   */
  async refreshToken(encryptedRefreshToken: string): Promise<AuthResponse> {
    try {
      // Decrypt and validate refresh token
      const refreshToken = this.tokenEncryptor.decrypt(encryptedRefreshToken);
      this.validateToken(refreshToken);

      // Attempt token refresh with retry mechanism
      const authResult = await this.retryHandler.retry(async () => {
        return await this.auth0Client.getTokenSilently({
          timeoutInSeconds: 60,
          useRefreshTokens: true
        });
      });

      // Process and secure new tokens
      const tokens = this.processAuthTokens(authResult);

      // Update session tracking
      this.updateSession(tokens);

      return tokens;

    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Private helper methods
   */

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = this.getSecureToken(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          return this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private generateCSRFToken(): string {
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  private validateCredentials(credentials: LoginCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw this.createAuthError(
        AUTH_ERRORS.INVALID_CREDENTIALS,
        'Invalid credentials provided'
      );
    }
  }

  private validateToken(token: string): void {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (decoded.exp * 1000 < Date.now()) {
        throw this.createAuthError(AUTH_ERRORS.SESSION_EXPIRED, 'Token has expired');
      }
    } catch {
      throw this.createAuthError(AUTH_ERRORS.UNAUTHORIZED, 'Invalid token');
    }
  }

  private processAuthTokens(authResult: any): AuthResponse {
    return {
      accessToken: this.tokenEncryptor.encrypt(authResult.accessToken),
      refreshToken: this.tokenEncryptor.encrypt(authResult.refreshToken),
      expiresIn: authResult.expiresIn,
      tokenType: authResult.tokenType,
      user: this.processUserProfile(authResult.user)
    };
  }

  private processUserProfile(profile: any): AuthUser {
    return {
      id: profile.sub,
      email: profile.email,
      role: profile.role,
      mfaEnabled: profile.mfaEnabled,
      lastLogin: new Date(profile.lastLogin)
    };
  }

  private createAuthError(type: AUTH_ERRORS, message: string): AuthError {
    return {
      type,
      message,
      code: type,
      details: {},
      timestamp: new Date()
    };
  }

  private handleAuthError(error: any): AuthError {
    return this.createAuthError(
      error.type || AUTH_ERRORS.NETWORK_ERROR,
      error.message || 'An authentication error occurred'
    );
  }

  private async handleUnauthorized(): Promise<any> {
    const refreshToken = this.getSecureToken(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
      return this.refreshToken(refreshToken);
    }
    throw this.createAuthError(AUTH_ERRORS.SESSION_EXPIRED, 'Session has expired');
  }

  private getSecureToken(key: string): string | null {
    const encryptedToken = localStorage.getItem(key);
    return encryptedToken ? this.tokenEncryptor.decrypt(encryptedToken) : null;
  }

  private clearSecureStorage(): void {
    Object.values(TOKEN_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private async revokeTokens(): Promise<void> {
    const accessToken = this.getSecureToken(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) {
      await this.axiosInstance.post('/revoke', { token: accessToken });
    }
  }

  private initializeSession(tokens: AuthResponse): void {
    localStorage.setItem(
      TOKEN_STORAGE_KEYS.ACCESS_TOKEN,
      this.tokenEncryptor.encrypt(tokens.accessToken)
    );
    localStorage.setItem(
      TOKEN_STORAGE_KEYS.REFRESH_TOKEN,
      this.tokenEncryptor.encrypt(tokens.refreshToken)
    );
  }

  private updateSession(tokens: AuthResponse): void {
    this.initializeSession(tokens);
  }
}