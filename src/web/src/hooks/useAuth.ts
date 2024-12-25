/**
 * Enhanced Authentication Hook
 * Provides secure authentication state management with comprehensive security features
 * @version 1.0.0
 */

import { useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { AuthService } from '../services/auth.service';
import { authActions } from '../store/auth/auth.slice';
import { 
  AuthUser, 
  AuthError, 
  AuthState,
  AuthPermission,
  hasPermission
} from '../types/auth.types';
import { 
  AUTH_ERRORS, 
  AUTH_PERMISSIONS,
  AUTH_ROLES 
} from '../constants/auth.constants';
import { authConfig } from '../config/auth.config';

// Security monitoring interval in milliseconds
const SECURITY_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Enhanced authentication hook with comprehensive security controls
 * Implements secure session management and role-based access control
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  const authService = new AuthService();

  /**
   * Secure login handler with rate limiting and security monitoring
   */
  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    try {
      dispatch(authActions.loginStart());

      // Validate rate limiting
      if (!authService.checkRateLimit(email)) {
        throw {
          type: AUTH_ERRORS.UNAUTHORIZED,
          message: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {},
          timestamp: new Date()
        } as AuthError;
      }

      // Attempt login with security validation
      const authResult = await authService.login({
        email,
        password,
        mfaCode
      });

      // Initialize secure session
      initializeSecureSession(authResult.user);

      dispatch(authActions.loginSuccess(authResult));
      return authResult;

    } catch (error) {
      const authError = authService.handleAuthError(error);
      dispatch(authActions.loginFailure(authError));
      throw authError;
    }
  }, [dispatch]);

  /**
   * Secure logout handler with session cleanup
   */
  const logout = useCallback(async () => {
    try {
      // Perform secure logout
      await authService.logout();
      
      // Clean up security context
      cleanupSecurityContext();
      
      dispatch(authActions.logout());
    } catch (error) {
      const authError = authService.handleAuthError(error);
      dispatch(authActions.setAuthError(authError));
      throw authError;
    }
  }, [dispatch]);

  /**
   * Check if user has specific permission
   */
  const checkPermission = useCallback((permission: AuthPermission): boolean => {
    if (!authState.user) return false;
    return hasPermission(authState.user, permission);
  }, [authState.user]);

  /**
   * Initialize secure session with monitoring
   */
  const initializeSecureSession = (user: AuthUser) => {
    // Set up session monitoring
    const securityInterval = setInterval(() => {
      validateSecurityContext();
    }, SECURITY_CHECK_INTERVAL);

    // Set up activity tracking
    document.addEventListener('mousemove', updateLastActivity);
    document.addEventListener('keypress', updateLastActivity);

    // Store security context
    window.sessionStorage.setItem('securityInterval', String(securityInterval));
  };

  /**
   * Clean up security context on logout
   */
  const cleanupSecurityContext = () => {
    // Clear security interval
    const intervalId = window.sessionStorage.getItem('securityInterval');
    if (intervalId) {
      clearInterval(Number(intervalId));
    }

    // Remove event listeners
    document.removeEventListener('mousemove', updateLastActivity);
    document.removeEventListener('keypress', updateLastActivity);

    // Clear secure storage
    window.sessionStorage.clear();
    window.localStorage.clear();
  };

  /**
   * Validate security context and session state
   */
  const validateSecurityContext = async () => {
    try {
      const isValid = await authService.validateSession();
      if (!isValid) {
        dispatch(authActions.sessionTimeout());
        await logout();
      }
    } catch (error) {
      console.error('Security validation failed:', error);
      await logout();
    }
  };

  /**
   * Update last activity timestamp
   */
  const updateLastActivity = () => {
    dispatch(authActions.updateSecurityContext({
      lastActivity: Date.now()
    }));
  };

  /**
   * Get current security context
   */
  const getSecurityContext = () => ({
    isAuthenticated: authState.isAuthenticated,
    sessionExpiresAt: authState.sessionExpiresAt,
    lastActivity: authState.lastActivity,
    securityEvents: authState.securityMetadata?.securityEvents || [],
    rateLimitRemaining: authState.rateLimitRemaining
  });

  return {
    // Authentication state
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,

    // Security context
    securityContext: getSecurityContext(),
    
    // Auth operations
    login,
    logout,
    checkPermission,

    // Constants
    AUTH_ROLES,
    AUTH_PERMISSIONS,

    // Session management
    validateSecurityContext,
    updateLastActivity
  };
};

export type UseAuth = ReturnType<typeof useAuth>;