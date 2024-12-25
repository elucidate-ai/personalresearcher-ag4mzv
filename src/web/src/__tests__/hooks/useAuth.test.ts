/**
 * Test Suite for useAuth Hook
 * Validates secure authentication flows, session management, and security controls
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^2.0.0
import { jest, describe, beforeAll, beforeEach, it, expect } from '@jest/globals'; // ^29.0.0

import { useAuth } from '../../hooks/useAuth';
import { AuthService } from '../../services/auth.service';
import { authActions } from '../../store/auth/auth.slice';
import { AUTH_ERRORS, AUTH_PERMISSIONS } from '../../constants/auth.constants';
import { AuthError, AuthUser } from '../../types/auth.types';

// Mock AuthService
jest.mock('../../services/auth.service');

// Test data
const mockUser: AuthUser = {
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

const mockAuthError: AuthError = {
  type: AUTH_ERRORS.UNAUTHORIZED,
  message: 'Invalid credentials',
  code: 'UNAUTHORIZED',
  details: {},
  timestamp: new Date()
};

describe('useAuth hook', () => {
  let mockStore: any;
  let mockAuthService: jest.Mocked<AuthService>;
  let wrapper: React.FC;

  beforeAll(() => {
    // Configure mock store
    mockStore = configureStore({
      reducer: {
        auth: (state = {
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
          sessionTimeout: 1800000,
          lastActivity: Date.now(),
          rateLimitRemaining: 1000,
          securityMetadata: {
            loginAttempts: 0,
            lastLoginAttempt: 0,
            securityEvents: []
          }
        }, action: any) => state
      }
    });

    // Configure wrapper with store provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Authentication Flow', () => {
    it('should handle successful login with security logging', async () => {
      // Setup
      mockAuthService.login.mockResolvedValue({
        isAuthenticated: true,
        user: mockUser,
        loading: false,
        error: null,
        sessionExpiresAt: new Date(Date.now() + 3600000)
      });
      mockAuthService.checkRateLimit.mockReturnValue(true);

      // Execute
      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      // Verify
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(mockAuthService.logSecurityEvent).toHaveBeenCalledWith(
        'login_success',
        expect.any(Object)
      );
    });

    it('should handle login failure with rate limiting', async () => {
      // Setup
      mockAuthService.checkRateLimit.mockReturnValue(false);

      // Execute
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Verify
      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(mockAuthService.logSecurityEvent).toHaveBeenCalledWith(
        'login_failure',
        expect.any(Object)
      );
    });
  });

  describe('Session Management', () => {
    it('should validate session and handle timeout', async () => {
      // Setup
      mockAuthService.validateSession.mockResolvedValue(false);

      // Execute
      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.validateSecurityContext();
      });

      // Verify
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockAuthService.logSecurityEvent).toHaveBeenCalledWith(
        'session_timeout',
        expect.any(Object)
      );
    });

    it('should track user activity and update last activity timestamp', async () => {
      // Setup
      const { result } = renderHook(() => useAuth(), { wrapper });
      const initialTimestamp = result.current.securityContext.lastActivity;

      // Execute
      await act(async () => {
        result.current.updateLastActivity();
      });

      // Verify
      expect(result.current.securityContext.lastActivity).toBeGreaterThan(initialTimestamp);
    });
  });

  describe('Security Controls', () => {
    it('should enforce role-based access control', () => {
      // Setup
      const { result } = renderHook(() => useAuth(), { wrapper });
      mockStore.dispatch(authActions.loginSuccess({ user: mockUser }));

      // Verify
      expect(result.current.checkPermission(AUTH_PERMISSIONS.CONTENT_ACCESS.READ)).toBe(true);
      expect(result.current.checkPermission(AUTH_PERMISSIONS.ADMIN.FULL_ACCESS)).toBe(false);
    });

    it('should handle secure logout with cleanup', async () => {
      // Setup
      const { result } = renderHook(() => useAuth(), { wrapper });
      mockStore.dispatch(authActions.loginSuccess({ user: mockUser }));

      // Execute
      await act(async () => {
        await result.current.logout();
      });

      // Verify
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(sessionStorage.getItem('securityInterval')).toBeNull();
      expect(mockAuthService.logSecurityEvent).toHaveBeenCalledWith(
        'logout_success',
        expect.any(Object)
      );
    });

    it('should track security events and rate limiting', async () => {
      // Setup
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Execute
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          try {
            await result.current.login('test@example.com', 'wrong-password');
          } catch (error) {
            // Expected
          }
        }
      });

      // Verify
      expect(mockAuthService.logSecurityEvent).toHaveBeenCalledTimes(3);
      expect(result.current.securityContext.rateLimitRemaining).toBeLessThan(1000);
    });
  });
});