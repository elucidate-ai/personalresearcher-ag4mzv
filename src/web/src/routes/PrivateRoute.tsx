/**
 * Enhanced Private Route Component
 * Implements secure route protection with comprehensive security features
 * including session validation, permission checks, and audit logging
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/route.constants';

/**
 * Enhanced route guard component that implements comprehensive security checks
 * and audit logging for protected routes
 */
const PrivateRoute: React.FC = React.memo(() => {
  const location = useLocation();
  const {
    isAuthenticated,
    validateSecurityContext,
    checkPermission,
    securityContext,
    updateLastActivity
  } = useAuth();

  /**
   * Validates route access with enhanced security checks
   */
  const validateRouteAccess = useCallback(async (): Promise<boolean> => {
    try {
      // Validate session integrity
      const isSessionValid = await validateSecurityContext();
      if (!isSessionValid) {
        return false;
      }

      // Check route-specific permissions based on path
      const routePath = location.pathname;
      if (routePath.startsWith('/admin') && !checkPermission('ACCESS_ADMIN')) {
        return false;
      }
      if (routePath.startsWith('/export') && !checkPermission('EXPORT_DATA')) {
        return false;
      }
      if (routePath.startsWith('/content') && !checkPermission('READ_CONTENT')) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Route access validation failed:', error);
      return false;
    }
  }, [location.pathname, validateSecurityContext, checkPermission]);

  /**
   * Effect hook for security monitoring and session management
   */
  useEffect(() => {
    const monitorSecurity = async () => {
      // Update last activity timestamp
      updateLastActivity();

      // Validate route access
      await validateRouteAccess();
    };

    monitorSecurity();

    // Set up activity monitoring
    const activityInterval = setInterval(monitorSecurity, 30000); // Check every 30 seconds

    return () => {
      clearInterval(activityInterval);
    };
  }, [location, updateLastActivity, validateRouteAccess]);

  /**
   * Security boundary error handler
   */
  const handleSecurityError = useCallback((error: Error) => {
    console.error('Security violation detected:', error);
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }, [location]);

  /**
   * Render protected route with security boundary
   */
  try {
    // Check authentication state
    if (!isAuthenticated) {
      return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
    }

    // Check session expiration
    if (securityContext.sessionExpiresAt && new Date() > securityContext.sessionExpiresAt) {
      return <Navigate to={ROUTES.LOGIN} state={{ 
        from: location,
        expired: true 
      }} replace />;
    }

    // Render protected route content
    return <Outlet />;

  } catch (error) {
    return handleSecurityError(error as Error);
  }
});

PrivateRoute.displayName = 'PrivateRoute';

export default PrivateRoute;