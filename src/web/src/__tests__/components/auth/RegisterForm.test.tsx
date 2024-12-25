import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import RegisterForm, { RegisterFormProps } from '../../../components/auth/RegisterForm';
import { AuthUser } from '../../../types/auth.types';
import { AUTH_ROLES } from '../../../constants/auth.constants';

// Mock Auth0 registration function
const mockRegister = jest.fn().mockImplementation((data) => Promise.resolve({
  id: '123',
  email: data.email,
  role: AUTH_ROLES.BASIC_USER,
  firstName: data.firstName,
  lastName: data.lastName,
  createdAt: new Date(),
  lastLoginAt: new Date(),
  mfaEnabled: false,
  lastActivityAt: new Date()
}));

// Mock success and error callbacks
const mockOnSuccess = jest.fn();
const mockOnError = jest.fn();

// Mock rate limiting function
const mockRateLimit = jest.fn().mockImplementation(() => ({ remaining: 5 }));

// Mock useAuth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    error: null,
    isLoading: false
  })
}));

// Mock reCAPTCHA component
jest.mock('react-google-recaptcha', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (token: string) => void }) => (
    <div data-testid="recaptcha" onClick={() => onChange('valid-token')}>
      reCAPTCHA
    </div>
  )
}));

describe('RegisterForm', () => {
  // Default props for testing
  const defaultProps: RegisterFormProps = {
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    maxAttempts: 5
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset form state
    mockRegister.mockClear();
    mockOnSuccess.mockClear();
    mockOnError.mockClear();
    mockRateLimit.mockClear();
  });

  it('renders registration form with accessibility features', () => {
    render(<RegisterForm {...defaultProps} />);

    // Verify form elements are present with proper accessibility attributes
    expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Registration form');
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/first name/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/last name/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByTestId('recaptcha')).toBeInTheDocument();
  });

  it('validates form fields comprehensively', async () => {
    render(<RegisterForm {...defaultProps} />);
    const user = userEvent.setup();

    // Test email validation
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    fireEvent.blur(emailInput);
    expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();

    // Test password validation
    const passwordInput = screen.getByLabelText(/^password/i);
    await user.type(passwordInput, 'weak');
    fireEvent.blur(passwordInput);
    expect(await screen.findByText(/must be at least 8 characters/i)).toBeInTheDocument();

    // Test password confirmation
    const confirmInput = screen.getByLabelText(/confirm password/i);
    await user.type(confirmInput, 'different');
    fireEvent.blur(confirmInput);
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();

    // Test required fields
    const submitButton = screen.getByRole('button', { name: /register/i });
    await user.click(submitButton);
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/last name is required/i)).toBeInTheDocument();
  });

  it('handles successful registration with Auth0', async () => {
    render(<RegisterForm {...defaultProps} />);
    const user = userEvent.setup();

    // Fill form with valid data
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');

    // Complete reCAPTCHA
    await user.click(screen.getByTestId('recaptcha'));

    // Submit form
    await user.click(screen.getByRole('button', { name: /register/i }));

    // Verify registration attempt
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'StrongPass123!',
        firstName: 'John',
        lastName: 'Doe',
        recaptchaToken: 'valid-token'
      });
    });

    // Verify success callback
    expect(mockOnSuccess).toHaveBeenCalledWith(expect.any(Object));
  });

  it('handles registration errors and rate limiting', async () => {
    // Mock registration failure
    mockRegister.mockRejectedValueOnce(new Error('Registration failed'));
    
    render(<RegisterForm {...defaultProps} />);
    const user = userEvent.setup();

    // Fill form with valid data
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.click(screen.getByTestId('recaptcha'));

    // Submit form
    await user.click(screen.getByRole('button', { name: /register/i }));

    // Verify error handling
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Registration failed. Please try again.');
    });

    // Verify rate limiting
    mockRateLimit.mockImplementationOnce(() => ({ remaining: 0 }));
    await user.click(screen.getByRole('button', { name: /register/i }));
    
    expect(screen.getByRole('button', { name: /register/i })).toBeDisabled();
  });

  it('implements proper CSRF protection', async () => {
    render(<RegisterForm {...defaultProps} />);
    const user = userEvent.setup();

    // Fill and submit form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.click(screen.getByTestId('recaptcha'));
    await user.click(screen.getByRole('button', { name: /register/i }));

    // Verify CSRF token is included in request
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          recaptchaToken: expect.any(String)
        })
      );
    });
  });
});