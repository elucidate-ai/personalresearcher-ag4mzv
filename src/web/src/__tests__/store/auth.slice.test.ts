/**
 * Authentication Slice Test Suite
 * Comprehensive tests for secure authentication state management
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // ^2.0.0
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import authReducer, {
  loginAsync,
  logoutAsync,
  updateSecurityMetadata,
  updateLastActivity,
  decrementRateLimit,
  resetSecurityState,
  setAuthError
} from '../../store/auth/auth.slice';
import { AuthService } from '../../services/auth.service';
import { AUTH_ERRORS, AUTH_STATES } from '../../constants/auth.constants';
import { AuthState, AuthUser, AuthError } from '../../types/auth.types';

// Mock AuthService
jest.mock('../../services/auth.service');
const mockAuthService = jest.mocked(AuthService);

// Mock security monitor
const mockSecurityMonitor = jest.fn();

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  
  beforeEach(() => {
    // Configure test store with security middleware
    store = configureStore({
      reducer: {
        auth: authReducer
      }
    });

    // Reset mocks
    jest.clearAllMocks();
    mockAuthService.mockClear();
    mockSecurityMonitor.mockClear();
  });

  test('should handle initial state', () => {
    const state = store.getState().auth;
    
    // Verify initial security state
    expect(state).toEqual({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      sessionTimeout: 1800000,
      lastActivity: expect.any(Number),
      rateLimitRemaining: 1000,
      securityMetadata: {
        loginAttempts: 0,
        lastLoginAttempt: 0,
        securityEvents: []
      }
    });
  });

  test('should handle successful login flow', async () => {
    // Mock successful auth response with security metadata
    const mockUser: AuthUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'BASIC_USER',
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      mfaEnabled: true,
      lastActivityAt: new Date()
    };

    mockAuthService.prototype.login.mockResolvedValueOnce({
      isAuthenticated: true,
      user: mockUser,
      loading: false,
      error: null,
      sessionExpiresAt: new Date(Date.now() + 1800000)
    });

    // Dispatch login with credentials
    await store.dispatch(loginAsync({
      email: 'test@example.com',
      password: 'secure-password',
      mfaCode: '123456'
    }));

    const state = store.getState().auth;

    // Verify authentication state
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastActivity).toBeDefined();
    expect(state.securityMetadata.loginAttempts).toBe(0);
  });

  test('should handle failed login attempt', async () => {
    // Mock authentication failure
    const mockError: AuthError = {
      type: AUTH_ERRORS.INVALID_CREDENTIALS,
      message: 'Invalid credentials provided',
      code: AUTH_ERRORS.INVALID_CREDENTIALS,
      details: {},
      timestamp: new Date()
    };

    mockAuthService.prototype.login.mockRejectedValueOnce(mockError);

    // Attempt login
    await store.dispatch(loginAsync({
      email: 'test@example.com',
      password: 'wrong-password'
    }));

    const state = store.getState().auth;

    // Verify error state
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toEqual(mockError);
    expect(state.securityMetadata.loginAttempts).toBe(1);
  });

  test('should handle rate limiting', async () => {
    // Simulate rate limit exceeded
    store.dispatch(decrementRateLimit());
    store.dispatch(decrementRateLimit());
    
    const state = store.getState().auth;
    expect(state.rateLimitRemaining).toBe(998);

    // Verify rate limit floor
    for (let i = 0; i < 1000; i++) {
      store.dispatch(decrementRateLimit());
    }
    expect(store.getState().auth.rateLimitRemaining).toBe(0);
  });

  test('should handle session management', () => {
    // Update activity timestamp
    const initialTimestamp = store.getState().auth.lastActivity;
    store.dispatch(updateLastActivity());
    
    const newTimestamp = store.getState().auth.lastActivity;
    expect(newTimestamp).toBeGreaterThan(initialTimestamp);
  });

  test('should handle security metadata updates', () => {
    // Update security metadata
    store.dispatch(updateSecurityMetadata({
      loginAttempts: 1,
      lastLoginAttempt: Date.now(),
      securityEvents: ['suspicious_activity_detected']
    }));

    const state = store.getState().auth;
    expect(state.securityMetadata.loginAttempts).toBe(1);
    expect(state.securityMetadata.securityEvents).toContain('suspicious_activity_detected');
  });

  test('should handle logout flow', async () => {
    // Mock successful logout
    mockAuthService.prototype.logout.mockResolvedValueOnce(undefined);

    // Set authenticated state first
    store.dispatch(loginAsync.fulfilled(
      {
        isAuthenticated: true,
        user: {} as AuthUser,
        loading: false,
        error: null,
        sessionExpiresAt: new Date()
      },
      'requestId',
      { email: 'test@example.com', password: 'password' }
    ));

    // Perform logout
    await store.dispatch(logoutAsync());

    const state = store.getState().auth;

    // Verify reset state
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toBeNull();
    expect(state.securityMetadata).toEqual({
      loginAttempts: 0,
      lastLoginAttempt: 0,
      securityEvents: []
    });
  });

  test('should handle security violations', () => {
    // Set security violation error
    const securityError: AuthError = {
      type: AUTH_ERRORS.UNAUTHORIZED,
      message: 'Security violation detected',
      code: AUTH_ERRORS.UNAUTHORIZED,
      details: { violation: 'suspicious_activity' },
      timestamp: new Date()
    };

    store.dispatch(setAuthError(securityError));

    const state = store.getState().auth;
    expect(state.error).toEqual(securityError);
    expect(state.loading).toBe(false);
  });

  test('should handle state reset', () => {
    // Set some state first
    store.dispatch(updateSecurityMetadata({
      loginAttempts: 5,
      lastLoginAttempt: Date.now(),
      securityEvents: ['test_event']
    }));

    // Reset state
    store.dispatch(resetSecurityState());

    const state = store.getState().auth;
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toBeNull();
    expect(state.securityMetadata).toEqual({
      loginAttempts: 0,
      lastLoginAttempt: 0,
      securityEvents: []
    });
    expect(state.rateLimitRemaining).toBe(1000);
  });
});