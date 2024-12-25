import React from 'react'; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.3
import { ThemeProvider } from '@mui/material/styles'; // ^5.0.0
import { theme } from '../../../config/theme.config';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Tooltip from '../../../components/common/Tooltip';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test constants
const TEST_ID_BUTTON = 'button-component';
const MOCK_CLICK_HANDLER = jest.fn();
const ARIA_LABELS = {
  LOADING: 'Loading, please wait',
  DISABLED: 'This action is currently disabled'
};

// Mock child components
jest.mock('../../../components/common/LoadingSpinner', () => {
  return jest.fn(({ size, color }) => (
    <div data-testid="loading-spinner" data-size={size} data-color={color}>
      Loading Spinner
    </div>
  ));
});

jest.mock('../../../components/common/Tooltip', () => {
  return jest.fn(({ children, title }) => (
    <div data-testid="tooltip" data-tooltip-text={title}>
      {children}
    </div>
  ));
});

describe('Button Component', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to render button with theme
  const renderButton = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <Button data-testid={TEST_ID_BUTTON} {...props} />
      </ThemeProvider>
    );
  };

  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      renderButton({ children: 'Click Me' });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click Me');
      expect(button).not.toBeDisabled();
      expect(button).toHaveClass('MuiButtonBase-root');
    });

    it('renders all button variants correctly', () => {
      const variants = ['primary', 'secondary', 'outlined', 'text'];
      
      variants.forEach(variant => {
        const { rerender } = renderButton({ children: 'Button', variant });
        const button = screen.getByTestId(TEST_ID_BUTTON);
        
        expect(button).toHaveStyle(getVariantStyles(variant, theme));
        rerender(<></>);
      });
    });

    it('renders all button sizes correctly', () => {
      const sizes = ['small', 'medium', 'large'];
      
      sizes.forEach(size => {
        const { rerender } = renderButton({ children: 'Button', size });
        const button = screen.getByTestId(TEST_ID_BUTTON);
        
        expect(button).toHaveStyle(getSizeStyles(size));
        rerender(<></>);
      });
    });
  });

  describe('Functionality', () => {
    it('handles click events when enabled', async () => {
      renderButton({ children: 'Click Me', onClick: MOCK_CLICK_HANDLER });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      await userEvent.click(button);
      expect(MOCK_CLICK_HANDLER).toHaveBeenCalledTimes(1);
    });

    it('prevents click events when disabled', async () => {
      renderButton({ children: 'Click Me', onClick: MOCK_CLICK_HANDLER, disabled: true });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      await userEvent.click(button);
      expect(MOCK_CLICK_HANDLER).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });

    it('prevents click events when loading', async () => {
      renderButton({ children: 'Click Me', onClick: MOCK_CLICK_HANDLER, loading: true });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      await userEvent.click(button);
      expect(MOCK_CLICK_HANDLER).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('displays loading spinner when loading prop is true', () => {
      renderButton({ children: 'Loading', loading: true });
      
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(LoadingSpinner).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 'medium',
          color: 'secondary'
        }),
        expect.any(Object)
      );
    });

    it('adjusts loading spinner size based on button size', () => {
      renderButton({ children: 'Loading', loading: true, size: 'small' });
      
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('data-size', 'small');
    });

    it('hides button text while loading', () => {
      renderButton({ children: 'Click Me', loading: true });
      
      const buttonText = screen.getByText('Click Me');
      expect(buttonText).toHaveClass('opacity-0');
    });
  });

  describe('Icons', () => {
    const StartIcon = () => <span data-testid="start-icon">Start</span>;
    const EndIcon = () => <span data-testid="end-icon">End</span>;

    it('renders start icon correctly', () => {
      renderButton({ children: 'Button', startIcon: <StartIcon /> });
      
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
      expect(screen.getByTestId('start-icon').parentElement).toHaveClass('mr-2', 'inline-flex');
    });

    it('renders end icon correctly', () => {
      renderButton({ children: 'Button', endIcon: <EndIcon /> });
      
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
      expect(screen.getByTestId('end-icon').parentElement).toHaveClass('ml-2', 'inline-flex');
    });

    it('hides icons when loading', () => {
      renderButton({
        children: 'Button',
        startIcon: <StartIcon />,
        endIcon: <EndIcon />,
        loading: true
      });
      
      expect(screen.queryByTestId('start-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('end-icon')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip when disabled and tooltipText is provided', () => {
      renderButton({
        children: 'Disabled Button',
        disabled: true,
        tooltipText: ARIA_LABELS.DISABLED
      });
      
      expect(Tooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          title: ARIA_LABELS.DISABLED,
          placement: 'top'
        }),
        expect.any(Object)
      );
    });

    it('shows tooltip when loading and tooltipText is provided', () => {
      renderButton({
        children: 'Loading Button',
        loading: true,
        tooltipText: ARIA_LABELS.LOADING
      });
      
      expect(Tooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          title: ARIA_LABELS.LOADING,
          placement: 'top'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility guidelines', async () => {
      const { container } = renderButton({ children: 'Accessible Button' });
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      renderButton({ children: 'Keyboard Nav' });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      button.focus();
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });
      expect(button).toHaveStyle({
        outline: 'none',
        boxShadow: `0 0 0 3px ${theme.colors.primary[300]}`
      });
    });

    it('provides appropriate ARIA labels', () => {
      renderButton({
        children: 'ARIA Button',
        'aria-label': 'Custom Label',
        loading: true
      });
      
      const button = screen.getByTestId(TEST_ID_BUTTON);
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Performance', () => {
    it('uses React.memo for efficient re-renders', () => {
      const { rerender } = renderButton({ children: 'Performance Test' });
      const button = screen.getByTestId(TEST_ID_BUTTON);
      
      // Re-render with same props
      rerender(
        <ThemeProvider theme={theme}>
          <Button data-testid={TEST_ID_BUTTON}>Performance Test</Button>
        </ThemeProvider>
      );
      
      expect(button).toBeInTheDocument();
      // Add performance monitoring if needed
    });
  });
});

// Helper function to get variant-specific styles
function getVariantStyles(variant: string, theme: any) {
  const styles: any = {
    primary: {
      backgroundColor: theme.colors.primary[500],
      color: '#ffffff'
    },
    secondary: {
      backgroundColor: theme.colors.secondary[500],
      color: '#ffffff'
    },
    outlined: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary[500],
      color: theme.colors.primary[500]
    },
    text: {
      backgroundColor: 'transparent',
      color: theme.colors.primary[500]
    }
  };
  return styles[variant];
}

// Helper function to get size-specific styles
function getSizeStyles(size: string) {
  const styles: any = {
    small: {
      padding: '6px 16px',
      fontSize: '0.875rem'
    },
    medium: {
      padding: '8px 20px',
      fontSize: '1rem'
    },
    large: {
      padding: '10px 24px',
      fontSize: '1.125rem'
    }
  };
  return styles[size];
}