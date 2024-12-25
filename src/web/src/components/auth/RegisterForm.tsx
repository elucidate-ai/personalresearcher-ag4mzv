/**
 * Registration Form Component
 * Implements secure user registration with comprehensive validation and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { useForm } from 'react-hook-form';
import ReCAPTCHA from 'react-google-recaptcha';

import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { validateEmail, validatePassword, sanitizeInput } from '../../utils/validation.utils';
import { AuthUser } from '../../types/auth.types';

// Constants for form validation
const PASSWORD_MIN_LENGTH = 8;
const MAX_ATTEMPTS = 5;
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

// Props interface for the registration form
export interface RegisterFormProps {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: string) => void;
  className?: string;
  maxAttempts?: number;
}

// Form data interface with validation requirements
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  recaptchaToken: string;
}

// Styled form container with accessibility enhancements
const StyledForm = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: '400px',
  margin: '0 auto',
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    gap: theme.spacing(2),
  },
}));

/**
 * Registration form component with enhanced security and accessibility
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
  className,
  maxAttempts = MAX_ATTEMPTS,
}) => {
  const { register: authRegister, error: authError, isLoading } = useAuth();
  const [attempts, setAttempts] = useState(0);
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');

  const {
    handleSubmit,
    register,
    watch,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<RegisterFormData>();

  // Watch password field for confirmation validation
  const password = watch('password');

  // Handle reCAPTCHA verification
  const handleRecaptchaVerify = useCallback((token: string | null) => {
    if (token) {
      setRecaptchaToken(token);
      clearErrors('recaptchaToken');
    }
  }, [clearErrors]);

  // Handle form submission with security checks
  const onSubmit = useCallback(async (data: RegisterFormData) => {
    try {
      // Check attempt limit
      if (attempts >= maxAttempts) {
        onError?.('Maximum registration attempts exceeded. Please try again later.');
        return;
      }

      // Validate reCAPTCHA
      if (!recaptchaToken) {
        setError('recaptchaToken', {
          type: 'manual',
          message: 'Please complete the reCAPTCHA verification',
        });
        return;
      }

      // Validate and sanitize inputs
      const { isValid: isEmailValid, errors: emailErrors } = validateEmail(data.email);
      if (!isEmailValid) {
        setError('email', { type: 'manual', message: emailErrors[0] });
        return;
      }

      const { isValid: isPasswordValid, errors: passwordErrors } = validatePassword(data.password);
      if (!isPasswordValid) {
        setError('password', { type: 'manual', message: passwordErrors[0] });
        return;
      }

      // Sanitize user inputs
      const sanitizedData = {
        email: sanitizeInput(data.email),
        password: data.password,
        firstName: sanitizeInput(data.firstName),
        lastName: sanitizeInput(data.lastName),
        recaptchaToken,
      };

      // Attempt registration
      const user = await authRegister(sanitizedData);
      onSuccess?.(user);

    } catch (error) {
      setAttempts(prev => prev + 1);
      onError?.(authError || 'Registration failed. Please try again.');
    }
  }, [
    attempts,
    maxAttempts,
    recaptchaToken,
    authRegister,
    authError,
    onSuccess,
    onError,
    setError,
  ]);

  return (
    <StyledForm
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      noValidate
      aria-label="Registration form"
    >
      <Input
        {...register('email', {
          required: 'Email is required',
          validate: value => validateEmail(value).isValid || 'Invalid email format',
        })}
        type="email"
        label="Email"
        error={!!errors.email}
        helperText={errors.email?.message}
        fullWidth
        required
        aria-required="true"
      />

      <Input
        {...register('password', {
          required: 'Password is required',
          minLength: {
            value: PASSWORD_MIN_LENGTH,
            message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
          },
          validate: value => validatePassword(value).isValid || 'Password does not meet requirements',
        })}
        type="password"
        label="Password"
        error={!!errors.password}
        helperText={errors.password?.message}
        fullWidth
        required
        aria-required="true"
      />

      <Input
        {...register('confirmPassword', {
          required: 'Please confirm your password',
          validate: value => value === password || 'Passwords do not match',
        })}
        type="password"
        label="Confirm Password"
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        fullWidth
        required
        aria-required="true"
      />

      <Input
        {...register('firstName', {
          required: 'First name is required',
          minLength: {
            value: 2,
            message: 'First name must be at least 2 characters',
          },
        })}
        type="text"
        label="First Name"
        error={!!errors.firstName}
        helperText={errors.firstName?.message}
        fullWidth
        required
        aria-required="true"
      />

      <Input
        {...register('lastName', {
          required: 'Last name is required',
          minLength: {
            value: 2,
            message: 'Last name must be at least 2 characters',
          },
        })}
        type="text"
        label="Last Name"
        error={!!errors.lastName}
        helperText={errors.lastName?.message}
        fullWidth
        required
        aria-required="true"
      />

      <ReCAPTCHA
        sitekey={RECAPTCHA_SITE_KEY}
        onChange={handleRecaptchaVerify}
        aria-label="reCAPTCHA verification"
      />
      {errors.recaptchaToken && (
        <span role="alert" className="error">
          {errors.recaptchaToken.message}
        </span>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading || attempts >= maxAttempts}
        aria-label="Register account"
      >
        Register
      </Button>

      {authError && (
        <div role="alert" className="error">
          {authError}
        </div>
      )}
    </StyledForm>
  );
};

export default RegisterForm;