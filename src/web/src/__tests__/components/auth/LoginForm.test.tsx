import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

import { LoginForm } from '../../../components/auth/LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { AUTH_ERRORS } from '../../../constants/auth.constants';

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Mock analytics
vi.mock('@analytics/core', () => ({
  default: {
    track: vi.fn()
  }
}));

// Test user credentials
const mockUser = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

// Mock functions
const mockLoginFn = vi.fn();
const mockOnSuccess = vi.fn();
const mockOnError = vi.fn();

describe('LoginForm Component', () => {
  // Setup before each test
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLoginFn,
      error: null,
      isLoading: false
    });
    // Mock CSRF token
    const mockCsrfToken = 'mock-csrf-token';
    Storage.prototype.getItem = vi.fn(() => mockCsrfToken);
  });

  // Basic Rendering Tests
  describe('Rendering', () => {
    it('renders the login form with all required fields', () => {
      render(<LoginForm />);
      
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
      const customClass = 'custom-class';
      render(<LoginForm className={customClass} />);
      
      expect(screen.getByRole('form')).toHaveClass(customClass);
    });

    it('uses provided testId for form element', () => {
      const testId = 'custom-test-id';
      render(<LoginForm testId={testId} />);
      
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
  });

  // Form Validation Tests
  describe('Form Validation', () => {
    it('validates required email field', async () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText(/email/i);
      
      await userEvent.type(emailInput, ' ');
      fireEvent.blur(emailInput);
      
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    });

    it('validates email format', async () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText(/email/i);
      
      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);
      
      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('validates required password field', async () => {
      render(<LoginForm />);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await userEvent.type(passwordInput, ' ');
      fireEvent.blur(passwordInput);
      
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });

    it('validates password complexity requirements', async () => {
      render(<LoginForm />);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await userEvent.type(passwordInput, 'weak');
      fireEvent.blur(passwordInput);
      
      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  // Authentication Flow Tests
  describe('Authentication Flow', () => {
    it('handles successful login', async () => {
      render(<LoginForm onSuccess={mockOnSuccess} />);
      
      await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
      
      fireEvent.submit(screen.getByRole('form'));
      
      await waitFor(() => {
        expect(mockLoginFn).toHaveBeenCalledWith(
          mockUser.email,
          mockUser.password
        );
      });
    });

    it('handles login failure', async () => {
      const mockError = {
        type: AUTH_ERRORS.INVALID_CREDENTIALS,
        message: 'Invalid credentials'
      };
      
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn().mockRejectedValue(mockError),
        error: mockError,
        isLoading: false
      });

      render(<LoginForm onError={mockOnError} />);
      
      await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
      
      fireEvent.submit(screen.getByRole('form'));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(mockError.message);
        expect(mockOnError).toHaveBeenCalledWith(mockError);
      });
    });

    it('shows loading state during authentication', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn(() => new Promise(resolve => setTimeout(resolve, 100))),
        error: null,
        isLoading: true
      });

      render(<LoginForm />);
      
      await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
      
      fireEvent.submit(screen.getByRole('form'));
      
      expect(screen.getByRole('button')).toHaveTextContent(/signing in/i);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  // Security Tests
  describe('Security Features', () => {
    it('includes CSRF token in form submission', async () => {
      render(<LoginForm />);
      
      await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
      
      fireEvent.submit(screen.getByRole('form'));
      
      expect(screen.getByRole('form')).toHaveFormValues({
        csrfToken: 'mock-csrf-token'
      });
    });

    it('prevents form submission when CSRF token is invalid', async () => {
      Storage.prototype.getItem = vi.fn(() => null);
      
      render(<LoginForm />);
      
      await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
      
      fireEvent.submit(screen.getByRole('form'));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid security token/i);
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<LoginForm />);
      
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sign in');
    });

    it('handles keyboard navigation', async () => {
      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button');

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      
      await userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);
      
      await userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });

    it('announces form errors to screen readers', async () => {
      render(<LoginForm />);
      
      fireEvent.submit(screen.getByRole('form'));
      
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });
});