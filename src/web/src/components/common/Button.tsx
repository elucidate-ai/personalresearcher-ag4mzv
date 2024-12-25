import React, { memo } from 'react'; // ^18.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { ButtonBase } from '@mui/material'; // ^5.0.0
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';

// Button variants and sizes constants
const BUTTON_VARIANTS = ['primary', 'secondary', 'outlined', 'text'] as const;
const BUTTON_SIZES = ['small', 'medium', 'large'] as const;

// Props interface for the Button component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: typeof BUTTON_VARIANTS[number];
  size?: typeof BUTTON_SIZES[number];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  tooltipText?: string;
  className?: string;
  children: React.ReactNode;
}

// Styled button component with theme integration
const StyledButton = styled(ButtonBase)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.shape.borderRadius,
  fontFamily: theme.typography.fontFamily,
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: theme.typography.fontSize,
  lineHeight: 1.75,
  letterSpacing: '0.02em',
  textTransform: 'none',
  minWidth: 64,
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: theme.transitions.create([
    'background-color',
    'box-shadow',
    'border-color',
    'color',
  ]),
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`,
  },
  '&:disabled': {
    cursor: 'not-allowed',
    pointerEvents: 'none',
    opacity: 0.6,
  },
}));

// Get variant-specific styles
const getVariantStyles = (variant: ButtonProps['variant'], theme: any) => {
  const styles: any = {
    primary: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    secondary: {
      backgroundColor: theme.palette.secondary.main,
      color: theme.palette.secondary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.secondary.dark,
      },
    },
    outlined: {
      backgroundColor: 'transparent',
      borderColor: theme.palette.primary.main,
      color: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    text: {
      backgroundColor: 'transparent',
      color: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
  };

  return styles[variant || 'primary'];
};

// Get size-specific styles
const getSizeStyles = (size: ButtonProps['size']) => {
  const styles: any = {
    small: {
      padding: '6px 16px',
      fontSize: '0.875rem',
    },
    medium: {
      padding: '8px 20px',
      fontSize: '1rem',
    },
    large: {
      padding: '10px 24px',
      fontSize: '1.125rem',
    },
  };

  return styles[size || 'medium'];
};

/**
 * A highly customizable, accessible button component that implements Material UI v5 design system
 * Supports multiple variants, sizes, loading states, and comprehensive accessibility features
 */
export const Button = memo(({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  tooltipText,
  className = '',
  children,
  onClick,
  ...rest
}: ButtonProps) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  // Handle button click with loading state
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled && onClick) {
      onClick(event);
    }
  };

  const buttonContent = (
    <StyledButton
      className={className}
      disabled={isDisabled}
      onClick={handleClick}
      style={{
        ...getVariantStyles(variant, theme),
        ...getSizeStyles(size),
        width: fullWidth ? '100%' : 'auto',
      }}
      {...rest}
    >
      {loading && (
        <LoadingSpinner
          size={size === 'small' ? 'small' : 'medium'}
          color={variant === 'outlined' || variant === 'text' ? 'primary' : 'secondary'}
        />
      )}
      {!loading && startIcon && (
        <span className="mr-2 inline-flex">{startIcon}</span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
      {!loading && endIcon && (
        <span className="ml-2 inline-flex">{endIcon}</span>
      )}
    </StyledButton>
  );

  // Wrap with tooltip if tooltipText is provided and button is disabled
  if (tooltipText && isDisabled) {
    return (
      <Tooltip title={tooltipText} placement="top">
        {buttonContent}
      </Tooltip>
    );
  }

  return buttonContent;
});

// Display name for debugging
Button.displayName = 'Button';

export default Button;