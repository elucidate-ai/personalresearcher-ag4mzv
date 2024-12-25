/**
 * Authentication Layout Component
 * Provides a consistent, secure, and accessible layout structure for authentication flows
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { useAuth0 } from '@auth0/auth0-react'; // v2.0.0
import { Card } from '../components/common/Card';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuth } from '../hooks/useAuth';
import { AuthUser } from '../types/auth.types';

// Constants for analytics tracking
const AUTH_EVENTS = {
  LOGIN_VIEW: 'auth_login_view',
  REGISTER_VIEW: 'auth_register_view',
  AUTH_SUCCESS: 'auth_success',
  AUTH_ERROR: 'auth_error'
} as const;

// Props interface for the AuthLayout component
export interface AuthLayoutProps {
  /** Content to be rendered inside the layout */
  children?: React.ReactNode;
  /** Authentication variant - login or register */
  variant: 'login' | 'register';
  /** Callback function called on successful authentication */
  onSuccess?: (user: AuthUser) => void;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional test ID for testing purposes */
  testId?: string;
}

// Styled container with responsive design and accessibility support
const AuthContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  zIndex: 1,

  // Responsive styles
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'currentColor',
  },
}));

// Styled card wrapper for auth forms
const AuthCard = styled(Card)(({ theme }) => ({
  width: '100%',
  maxWidth: 480,
  margin: theme.spacing(2),
  padding: theme.spacing(4),
  
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    margin: theme.spacing(1),
  },
}));

/**
 * AuthLayout component providing consistent structure for authentication flows
 * Implements secure authentication with Auth0 integration and accessibility features
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  variant = 'login',
  onSuccess,
  className,
  testId = 'auth-layout',
}) => {
  const { isAuthenticated, user, error } = useAuth();
  const { loginWithRedirect } = useAuth0();
  const auth = useAuth();

  // Track authentication views
  useEffect(() => {
    const eventName = variant === 'login' ? AUTH_EVENTS.LOGIN_VIEW : AUTH_EVENTS.REGISTER_VIEW;
    // Analytics tracking would go here
  }, [variant]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((authUser: AuthUser) => {
    // Track successful authentication
    // Analytics tracking would go here
    
    // Update auth state
    auth.updateLastActivity();
    
    // Call success callback
    onSuccess?.(authUser);
  }, [auth, onSuccess]);

  // Handle authentication errors
  const handleAuthError = useCallback((error: string) => {
    // Track authentication error
    // Analytics tracking would go here
    
    console.error('Authentication error:', error);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      handleAuthSuccess(user);
    }
  }, [isAuthenticated, user, handleAuthSuccess]);

  return (
    <AuthContainer 
      className={className}
      data-testid={testId}
      role="main"
      aria-label={`${variant === 'login' ? 'Login' : 'Registration'} page`}
    >
      <AuthCard
        elevation={2}
        role="region"
        aria-label={`${variant === 'login' ? 'Login' : 'Registration'} form`}
      >
        {variant === 'login' ? (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            testId="login-form"
          />
        ) : (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            className="w-full"
          />
        )}

        {error && (
          <div 
            role="alert"
            className="text-error-500 text-sm mt-4"
            aria-live="polite"
          >
            {error.message}
          </div>
        )}
      </AuthCard>
    </AuthContainer>
  );
};

// Export for use in other components
export default AuthLayout;