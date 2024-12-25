/**
 * Enhanced Login Form Component
 * Implements secure authentication flow with comprehensive validation and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import analytics from '@analytics/core';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { validateEmail, validatePassword } from '../../utils/validation.utils';

// Rate limiting constants
const RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 300000; // 5 minutes

// Validation schema with enhanced security requirements
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .test('email-validation', 'Invalid email format', (value) => {
      if (!value) return false;
      const { isValid } = validateEmail(value);
      return isValid;
    }),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .test('password-validation', 'Password does not meet security requirements', (value) => {
      if (!value) return false;
      const { isValid } = validatePassword(value);
      return isValid;
    }),
  csrfToken: yup.string().required()
});

// Interface for form data
interface LoginFormData {
  email: string;
  password: string;
  csrfToken: string;
  deviceFingerprint: string;
}

// Props interface
interface LoginFormProps {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: AuthError) => void;
  className?: string;
  testId?: string;
}

/**
 * Enhanced login form with comprehensive security features and accessibility support
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  className = '',
  testId = 'login-form'
}) => {
  const { login, error: authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Initialize form with validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<LoginFormData>({
    mode: 'onBlur',
    resolver: yup.object().shape(validationSchema)
  });

  // Generate CSRF token
  const generateCSRFToken = useCallback(() => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }, []);

  // Handle form submission with security measures
  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setSecurityError(null);

      // Track login attempt
      analytics.track('login_attempt', {
        timestamp: new Date().toISOString()
      });

      // Validate CSRF token
      if (data.csrfToken !== sessionStorage.getItem('csrfToken')) {
        throw new Error('Invalid security token');
      }

      // Attempt login
      const result = await login(data.email, data.password);

      // Handle successful login
      if (result) {
        analytics.track('login_success', {
          timestamp: new Date().toISOString()
        });
        onSuccess?.(result.user);
      }

    } catch (error) {
      // Handle login failure
      analytics.track('login_failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      setSecurityError(error instanceof Error ? error.message : 'Authentication failed');
      onError?.(error as AuthError);

    } finally {
      setIsSubmitting(false);
    }
  };

  // Set CSRF token on mount
  React.useEffect(() => {
    const csrfToken = generateCSRFToken();
    sessionStorage.setItem('csrfToken', csrfToken);
  }, [generateCSRFToken]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`space-y-6 ${className}`}
      data-testid={testId}
      noValidate
    >
      {/* Email Input */}
      <Input
        type="email"
        label="Email"
        error={!!errors.email}
        helperText={errors.email?.message}
        {...register('email')}
        fullWidth
        required
        autoComplete="email"
        aria-label="Email address"
      />

      {/* Password Input */}
      <Input
        type="password"
        label="Password"
        error={!!errors.password}
        helperText={errors.password?.message}
        {...register('password')}
        fullWidth
        required
        autoComplete="current-password"
        aria-label="Password"
      />

      {/* Security Error Display */}
      {(securityError || authError) && (
        <div
          role="alert"
          className="text-error-500 text-sm mt-2"
          aria-live="polite"
        >
          {securityError || authError?.message}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isSubmitting}
        disabled={isSubmitting}
        aria-label={isSubmitting ? 'Signing in...' : 'Sign in'}
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>

      {/* Hidden CSRF Token Field */}
      <input
        type="hidden"
        {...register('csrfToken')}
        value={sessionStorage.getItem('csrfToken') || ''}
      />
    </form>
  );
};

// Export for use in other components
export type { LoginFormProps, LoginFormData };
export default LoginForm;