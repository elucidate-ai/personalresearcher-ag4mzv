/**
 * Input Component
 * Version: 1.0.0
 * 
 * A reusable form input component that implements the design system's input field styles,
 * validation, and accessibility features. Supports various input types, states, and 
 * validation patterns with enhanced accessibility and theme integration.
 */

import React, { useCallback, useEffect, useState } from 'react'; // v18.0.0
import { styled, useTheme } from '@mui/material/styles'; // v5.0.0
import { TextField } from '@mui/material'; // v5.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { validateEmail, validatePassword } from '../../utils/validation.utils';

// Constants for input configuration
const INPUT_TYPES = ['text', 'password', 'email', 'number', 'search', 'url'] as const;
const INPUT_SIZES = ['small', 'medium', 'large'] as const;
const VALIDATION_MODES = ['onChange', 'onBlur', 'both'] as const;
const DEFAULT_DEBOUNCE_MS = 300;

// Input component props interface
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  type?: typeof INPUT_TYPES[number];
  size?: typeof INPUT_SIZES[number];
  label: string;
  error?: boolean;
  helperText?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  fullWidth?: boolean;
  required?: boolean;
  disabled?: boolean;
  validationMode?: typeof VALIDATION_MODES[number];
  validationDebounce?: number;
}

// Styled TextField component with theme integration
const StyledTextField = styled(TextField)(({ theme, error, fullWidth }) => ({
  margin: theme.spacing(1, 0),
  width: fullWidth ? '100%' : 'auto',
  fontFamily: theme.typography.fontFamily,
  transition: theme.transitions.create(['border-color', 'box-shadow', 'background-color']),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  boxShadow: error ? theme.shadows[1] : 'none',

  '& .MuiInputBase-root': {
    position: 'relative',
    fontSize: theme.typography.body1.fontSize,
    
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    
    '&.Mui-focused': {
      backgroundColor: theme.palette.background.paper,
      boxShadow: error ? theme.shadows[2] : theme.shadows[1],
    },
  },

  '& .MuiInputBase-input': {
    padding: theme.spacing(1.5),
    height: 'auto',
    
    '&::placeholder': {
      color: theme.palette.text.secondary,
      opacity: 0.7,
    },
  },

  '& .MuiFormHelperText-root': {
    marginLeft: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
  },

  // Dark mode support
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: theme.palette.background.default,
    '& .MuiInputBase-input': {
      color: theme.palette.text.primary,
    },
  }),
}));

/**
 * Input component with enhanced validation and accessibility features
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    type = 'text',
    size = 'medium',
    label,
    error = false,
    helperText,
    startAdornment,
    endAdornment,
    fullWidth = false,
    required = false,
    disabled = false,
    validationMode = 'both',
    validationDebounce = DEFAULT_DEBOUNCE_MS,
    onChange,
    onBlur,
    value,
    ...rest
  } = props;

  const theme = useTheme();
  const [inputValue, setInputValue] = useState(value || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [debouncedValue] = useDebounce(inputValue, validationDebounce);

  // Validation handler
  const validateInput = useCallback((val: string) => {
    if (!val && required) {
      setValidationError('This field is required');
      return;
    }

    switch (type) {
      case 'email': {
        const { isValid, errors } = validateEmail(val);
        setValidationError(isValid ? null : errors[0]);
        break;
      }
      case 'password': {
        const { isValid, errors } = validatePassword(val);
        setValidationError(isValid ? null : errors[0]);
        break;
      }
      case 'url': {
        const urlPattern = /^https?:\/\/.+\..+$/;
        setValidationError(
          val && !urlPattern.test(val) ? 'Please enter a valid URL' : null
        );
        break;
      }
      case 'number': {
        const numValue = Number(val);
        setValidationError(
          val && isNaN(numValue) ? 'Please enter a valid number' : null
        );
        break;
      }
      default:
        setValidationError(null);
    }
  }, [type, required]);

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    
    if (validationMode === 'onChange' || validationMode === 'both') {
      validateInput(newValue);
    }
    
    onChange?.(event);
  };

  // Handle input blur
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (validationMode === 'onBlur' || validationMode === 'both') {
      validateInput(event.target.value);
    }
    
    onBlur?.(event);
  };

  // Validate on debounced value change
  useEffect(() => {
    if (validationMode === 'onChange' || validationMode === 'both') {
      validateInput(debouncedValue as string);
    }
  }, [debouncedValue, validateInput, validationMode]);

  // Size-specific styles
  const sizeStyles = {
    small: {
      fontSize: theme.typography.body2.fontSize,
      padding: theme.spacing(1),
    },
    medium: {
      fontSize: theme.typography.body1.fontSize,
      padding: theme.spacing(1.5),
    },
    large: {
      fontSize: theme.typography.h6.fontSize,
      padding: theme.spacing(2),
    },
  };

  return (
    <StyledTextField
      inputRef={ref}
      type={type}
      label={label}
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      error={error || !!validationError}
      helperText={validationError || helperText}
      fullWidth={fullWidth}
      required={required}
      disabled={disabled}
      InputProps={{
        startAdornment,
        endAdornment,
        style: sizeStyles[size],
      }}
      // Accessibility attributes
      aria-required={required}
      aria-invalid={error || !!validationError}
      aria-describedby={`${label}-helper-text`}
      {...rest}
    />
  );
});

// Display name for debugging
Input.displayName = 'Input';

export default Input;