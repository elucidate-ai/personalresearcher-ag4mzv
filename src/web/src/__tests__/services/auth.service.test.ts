/**
 * AuthService Test Suite
 * Comprehensive tests for authentication flows, token management, and security controls
 * @version 1.0.0
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.7.0
import { AuthService } from '../../services/auth.service';
import { AuthApi } from '../../lib/api/auth.api';
import { AUTH_ERRORS, AUTH_STATES, TOKEN_STORAGE_KEYS } from '../../constants/auth.constants';
import { AuthUser, LoginCredentials, AuthState, AuthError } from '../../types/auth.types';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key],
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window event listeners
const mockAddEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });

// Test data
const testUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'BASIC_USER',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date(),
  lastLoginAt: new Date(),
  mfaEnabled: false,
  lastActivityAt: new Date()
};

const testCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!',
  mfaCode: '123456'
};

describe('AuthService', () => {
  let mockAuthApi: jest.Mocked<AuthApi>;
  let authService: AuthService;

  beforeEach(() => {
    // Clear localStorage and reset mocks
    localStorage.clear();
    jest.clearAllMocks();

    // Mock AuthApi
    mockAuthApi = {
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      validateSession: jest.fn()
    } as unknown as jest.Mocked<AuthApi>;

    // Initialize AuthService
    authService = new AuthService(mockAuthApi);

    // Mock Date.now for consistent timing tests
    jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Flow', () => {
    test('successful login with valid credentials', async () => {
      // Mock successful login response
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 1800,
        user: testUser,
        tokenType: 'Bearer'
      };

      mockAuthApi.login.mockResolvedValueOnce(mockResponse);

      // Attempt login
      const result = await authService.login(testCredentials);

      // Verify successful login
      expect(result).toEqual({
        isAuthenticated: true,
        user: testUser,
        loading: false,
        error: null,
        sessionExpiresAt: expect.any(Date)
      });

      // Verify tokens stored securely
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)).toBeTruthy();
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)).toBeTruthy();

      // Verify API called with correct credentials
      expect(mockAuthApi.login).toHaveBeenCalledWith(testCredentials);
    });

    test('login failure with invalid credentials', async () => {
      // Mock login failure
      const mockError: AuthError = {
        type: AUTH_ERRORS.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
        code: AUTH_ERRORS.INVALID_CREDENTIALS,
        details: {},
        timestamp: new Date()
      };

      mockAuthApi.login.mockRejectedValueOnce(mockError);

      // Attempt login and expect failure
      await expect(authService.login(testCredentials)).rejects.toEqual(mockError);

      // Verify no tokens stored
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    });

    test('successful logout', async () => {
      // Setup authenticated state
      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-token');
      
      // Mock successful logout
      mockAuthApi.logout.mockResolvedValueOnce();

      // Perform logout
      await authService.logout();

      // Verify cleanup
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
      expect(authService.getAuthState().isAuthenticated).toBeFalsy();
    });
  });

  describe('Session Management', () => {
    test('session timeout after inactivity', async () => {
      // Setup authenticated session
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 1800,
        user: testUser,
        tokenType: 'Bearer'
      };

      mockAuthApi.login.mockResolvedValueOnce(mockResponse);
      await authService.login(testCredentials);

      // Fast-forward time past inactivity timeout
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

      // Verify session expired
      const authState = authService.getAuthState();
      expect(authState.isAuthenticated).toBeFalsy();
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    });

    test('successful token refresh', async () => {
      // Setup expiring session
      const mockRefreshResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 1800,
        user: testUser,
        tokenType: 'Bearer'
      };

      mockAuthApi.refreshToken.mockResolvedValueOnce(mockRefreshResponse);

      // Trigger token refresh
      await authService['refreshToken']();

      // Verify new tokens stored
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)).toBeTruthy();
      expect(localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)).toBeTruthy();
    });
  });

  describe('Security Controls', () => {
    test('rate limiting on failed login attempts', async () => {
      // Mock login failure
      const mockError: AuthError = {
        type: AUTH_ERRORS.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: AUTH_ERRORS.INVALID_CREDENTIALS,
        details: {},
        timestamp: new Date()
      };

      mockAuthApi.login.mockRejectedValue(mockError);

      // Attempt multiple logins
      for (let i = 0; i < 5; i++) {
        await expect(authService.login(testCredentials)).rejects.toEqual(mockError);
      }

      // Verify rate limit exceeded
      const rateLimitError = {
        type: AUTH_ERRORS.UNAUTHORIZED,
        message: 'Too many login attempts. Please try again later.',
        code: AUTH_ERRORS.UNAUTHORIZED,
        details: {},
        timestamp: expect.any(Date)
      };

      await expect(authService.login(testCredentials)).rejects.toEqual(rateLimitError);
    });

    test('secure token storage', async () => {
      // Mock successful login
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 1800,
        user: testUser,
        tokenType: 'Bearer'
      };

      mockAuthApi.login.mockResolvedValueOnce(mockResponse);
      await authService.login(testCredentials);

      // Verify tokens are encrypted in storage
      const storedAccessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
      expect(storedAccessToken).not.toBe('mock-access-token');
      expect(storedAccessToken?.length).toBeGreaterThan(24);
    });

    test('activity tracking', () => {
      // Verify activity listeners registered
      expect(mockAddEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('keypress', expect.any(Function));
    });
  });
});