/**
 * Enhanced Authentication Service
 * Implements secure authentication state management with comprehensive security features
 * @version 1.0.0
 */

import { jwtDecode } from 'jwt-decode'; // ^4.0.0
import CryptoJS from 'crypto-js'; // ^4.2.0
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // ^4.0.0

import { AuthApi } from '../lib/api/auth.api';
import { AuthUser, AuthState, TokenPayload, AuthError, LoginCredentials } from '../types/auth.types';
import { authConfig } from '../config/auth.config';
import { AUTH_ERRORS, AUTH_STATES, TOKEN_STORAGE_KEYS } from '../constants/auth.constants';

/**
 * Security monitor for tracking authentication events and anomalies
 */
class SecurityMonitor {
  private readonly events: Map<string, number> = new Map();
  private readonly fingerprint: Promise<string>;

  constructor() {
    this.fingerprint = this.initializeFingerprint();
  }

  private async initializeFingerprint(): Promise<string> {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  }

  async trackEvent(eventType: string, metadata: Record<string, any> = {}): Promise<void> {
    const deviceId = await this.fingerprint;
    const count = (this.events.get(eventType) || 0) + 1;
    this.events.set(eventType, count);

    // Log security event with context
    console.info('Security Event:', {
      type: eventType,
      deviceId,
      count,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  async validateDevice(): Promise<boolean> {
    const storedFingerprint = localStorage.getItem('device_fingerprint');
    const currentFingerprint = await this.fingerprint;
    return storedFingerprint === currentFingerprint;
  }
}

/**
 * Token encryptor for secure token storage
 */
class TokenEncryptor {
  private readonly key: string;

  constructor(encryptionKey: string) {
    this.key = encryptionKey;
  }

  encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, this.key).toString();
  }

  decrypt(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

/**
 * Rate limiter for authentication attempts
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number
  ) {}

  checkLimit(key: string): boolean {
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
 * Enhanced Authentication Service with comprehensive security features
 */
export class AuthService {
  private currentUser: AuthUser | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private readonly securityMonitor: SecurityMonitor;
  private readonly tokenEncryptor: TokenEncryptor;
  private readonly rateLimiter: RateLimiter;

  constructor(
    private readonly authApi: AuthApi
  ) {
    this.securityMonitor = new SecurityMonitor();
    this.tokenEncryptor = new TokenEncryptor(authConfig.securitySettings.encryptionKey);
    this.rateLimiter = new RateLimiter(
      authConfig.securitySettings.rateLimit.maxAttempts,
      authConfig.securitySettings.rateLimit.windowMs
    );
    this.initializeActivityTracking();
  }

  /**
   * Authenticates user with enhanced security validation
   */
  async login(credentials: LoginCredentials): Promise<AuthState> {
    try {
      // Rate limiting check
      if (!this.rateLimiter.checkLimit(credentials.email)) {
        throw this.createAuthError(
          AUTH_ERRORS.UNAUTHORIZED,
          'Too many login attempts. Please try again later.'
        );
      }

      // Device fingerprint validation
      const isValidDevice = await this.securityMonitor.validateDevice();
      if (!isValidDevice) {
        await this.securityMonitor.trackEvent('suspicious_device_detected');
      }

      // Perform authentication
      const response = await this.authApi.login(credentials);

      // Process and validate tokens
      const accessToken = this.tokenEncryptor.encrypt(response.accessToken);
      const refreshToken = this.tokenEncryptor.encrypt(response.refreshToken);

      // Set tokens in secure storage
      this.setSecureTokens(accessToken, refreshToken);

      // Initialize user session
      this.currentUser = response.user;
      this.startTokenRefreshTimer(response.expiresIn);
      this.resetActivityTimer();

      // Track successful login
      await this.securityMonitor.trackEvent('login_success', {
        userId: response.user.id,
        role: response.user.role
      });

      return {
        isAuthenticated: true,
        user: response.user,
        loading: false,
        error: null,
        sessionExpiresAt: new Date(Date.now() + response.expiresIn * 1000)
      };

    } catch (error) {
      // Track failed attempt
      this.rateLimiter.addAttempt(credentials.email);
      await this.securityMonitor.trackEvent('login_failure', { error });

      throw this.handleAuthError(error);
    }
  }

  /**
   * Logs out user and cleans up security context
   */
  async logout(): Promise<void> {
    try {
      await this.authApi.logout();
      this.clearSecurityContext();
      await this.securityMonitor.trackEvent('logout_success');
    } catch (error) {
      await this.securityMonitor.trackEvent('logout_error', { error });
      throw this.handleAuthError(error);
    }
  }

  /**
   * Returns current authentication state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: !!this.currentUser,
      user: this.currentUser,
      loading: false,
      error: null,
      sessionExpiresAt: this.getSessionExpiry()
    };
  }

  /**
   * Private helper methods
   */

  private async refreshToken(): Promise<void> {
    try {
      const refreshToken = this.getSecureToken(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) throw new Error('No refresh token available');

      const response = await this.authApi.refreshToken(refreshToken);
      
      const accessToken = this.tokenEncryptor.encrypt(response.accessToken);
      const newRefreshToken = this.tokenEncryptor.encrypt(response.refreshToken);

      this.setSecureTokens(accessToken, newRefreshToken);
      this.startTokenRefreshTimer(response.expiresIn);

      await this.securityMonitor.trackEvent('token_refresh_success');
    } catch (error) {
      await this.securityMonitor.trackEvent('token_refresh_failure', { error });
      this.handleSessionExpiration();
    }
  }

  private setSecureTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  private getSecureToken(key: string): string | null {
    const token = localStorage.getItem(key);
    return token ? this.tokenEncryptor.decrypt(token) : null;
  }

  private clearSecurityContext(): void {
    this.currentUser = null;
    localStorage.clear();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.activityTimer) clearInterval(this.activityTimer);
  }

  private startTokenRefreshTimer(expiresIn: number): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    
    // Refresh token before expiry
    const refreshTime = (expiresIn - 300) * 1000; // 5 minutes before expiry
    this.refreshTimer = setInterval(() => this.refreshToken(), refreshTime);
  }

  private initializeActivityTracking(): void {
    window.addEventListener('mousemove', () => this.resetActivityTimer());
    window.addEventListener('keypress', () => this.resetActivityTimer());
  }

  private resetActivityTimer(): void {
    if (this.activityTimer) clearTimeout(this.activityTimer);
    
    // Auto logout after inactivity
    this.activityTimer = setTimeout(
      () => this.handleInactivity(),
      30 * 60 * 1000 // 30 minutes
    );
  }

  private async handleInactivity(): Promise<void> {
    await this.securityMonitor.trackEvent('session_inactivity');
    await this.logout();
  }

  private handleSessionExpiration(): void {
    this.clearSecurityContext();
    window.location.href = '/login?expired=true';
  }

  private getSessionExpiry(): Date | null {
    const token = this.getSecureToken(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return null;

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
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
}