/**
 * Registration Page Component
 * Implements secure user registration flow with Auth0 integration and enhanced security features
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';

import { AuthLayoutProps } from '../../layouts/AuthLayout';
import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../hooks/useAuth';
import { AuthUser } from '../../types/auth.types';

// Constants for rate limiting and security
const REGISTRATION_RATE_LIMIT = 10; // attempts per minute
const REGISTRATION_TIMEOUT = 30000; // 30 seconds

/**
 * Registration error interface for structured error handling
 */
interface RegistrationError {
  code: string;
  message: string;
  details: any;
}

/**
 * Registration page component that handles user registration with comprehensive security
 * and accessibility features
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showBoundary } = useErrorBoundary();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  /**
   * Handle successful registration with analytics tracking
   * @param user - Authenticated user object
   */
  const handleRegistrationSuccess = useCallback(async (user: AuthUser) => {
    try {
      // Track successful registration
      if (window.analytics) {
        await window.analytics.track('registration_success', {
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      }

      // Navigate to onboarding or dashboard
      navigate('/onboarding', { 
        replace: true,
        state: { 
          isNewUser: true,
          userId: user.id 
        }
      });

    } catch (error) {
      console.error('Registration success handler failed:', error);
      // Still navigate even if analytics fails
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  /**
   * Handle registration errors with structured error reporting
   * @param error - Registration error object
   */
  const handleRegistrationError = useCallback((error: RegistrationError) => {
    // Track registration failure
    if (window.analytics) {
      window.analytics.track('registration_error', {
        error_code: error.code,
        error_message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Show error boundary with structured error
    showBoundary({
      name: 'RegistrationError',
      message: error.message,
      code: error.code,
      details: error.details
    });
  }, [showBoundary]);

  // Auth layout props configuration
  const authLayoutProps: AuthLayoutProps = {
    variant: 'register',
    onSuccess: handleRegistrationSuccess,
    className: 'w-full max-w-md mx-auto p-6',
    testId: 'register-page'
  };

  return (
    <AuthLayout
      {...authLayoutProps}
      aria-label="Registration page"
      role="main"
    >
      {/* Registration form is rendered by AuthLayout based on variant */}
    </AuthLayout>
  );
};

// Set display name for debugging
RegisterPage.displayName = 'RegisterPage';

export default RegisterPage;

// Export types for external use
export type { RegistrationError };