/**
 * Enhanced Public Route Guard Component
 * Implements secure route protection for public routes with comprehensive security monitoring
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/route.constants';

/**
 * Enhanced PublicRoute component that implements secure public route protection
 * Prevents authenticated users from accessing public routes and maintains security logs
 * 
 * @returns JSX.Element - Renders child routes or performs secure redirect to dashboard
 */
const PublicRoute: React.FC = React.memo(() => {
  const { 
    isAuthenticated, 
    validateSecurityContext, 
    securityContext,
    updateLastActivity 
  } = useAuth();

  /**
   * Effect hook to perform security validation on route access
   * Validates session state and updates activity tracking
   */
  useEffect(() => {
    const validateSecurity = async () => {
      try {
        // Validate security context on public route access
        await validateSecurityContext();
        
        // Update last activity timestamp for security monitoring
        updateLastActivity();

      } catch (error) {
        console.error('Security validation failed:', error);
      }
    };

    validateSecurity();
  }, [validateSecurityContext, updateLastActivity]);

  /**
   * Security context monitoring
   * Logs security-relevant information about public route access
   */
  useEffect(() => {
    if (isAuthenticated) {
      console.info('Security Event: Authenticated user attempting public route access', {
        timestamp: new Date().toISOString(),
        sessionExpiresAt: securityContext.sessionExpiresAt,
        lastActivity: securityContext.lastActivity,
        securityEvents: securityContext.securityEvents
      });
    }
  }, [isAuthenticated, securityContext]);

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Render child routes for unauthenticated users
  return <Outlet />;
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

export default PublicRoute;