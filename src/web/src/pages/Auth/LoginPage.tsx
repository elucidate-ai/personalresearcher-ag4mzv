/**
 * Login Page Component
 * Implements secure authentication flow with comprehensive security monitoring and accessibility
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout } from '../../layouts/AuthLayout';

// Route constants
const DASHBOARD_ROUTE = '/dashboard';

/**
 * Enhanced login page component with security monitoring and accessibility features
 * Implements secure authentication flow with rate limiting and comprehensive validation
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    isLoading, 
    error,
    user,
    login,
    validateSecurityContext,
    updateLastActivity 
  } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      // Update security context before navigation
      updateLastActivity();
      navigate(DASHBOARD_ROUTE);
    }
  }, [isAuthenticated, user, navigate, updateLastActivity]);

  // Validate security context on mount
  useEffect(() => {
    validateSecurityContext();
  }, [validateSecurityContext]);

  /**
   * Handle successful login with security logging
   * @param user - Authenticated user object
   */
  const handleLoginSuccess = async (user: AuthUser) => {
    try {
      // Update security context
      updateLastActivity();
      
      // Navigate to dashboard
      navigate(DASHBOARD_ROUTE);
    } catch (error) {
      console.error('Login success handler failed:', error);
    }
  };

  /**
   * Handle login error with security monitoring
   * @param error - Authentication error object
   */
  const handleLoginError = (error: AuthError) => {
    console.error('Login failed:', error);
    // Error handling is managed by AuthLayout component
  };

  // Show loading state
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-label="Loading authentication"
      >
        <CircularProgress 
          size={40}
          aria-label="Authenticating..."
        />
      </div>
    );
  }

  return (
    <AuthLayout
      variant="login"
      onSuccess={handleLoginSuccess}
      testId="login-page"
      aria-label="Login page"
    />
  );
};

// Export for use in routing
export default LoginPage;